<template>
  <div class="restocking">
    <div class="page-header">
      <h2>Restocking</h2>
      <p>Set your budget and get intelligent restocking recommendations based on current inventory levels and demand forecasts.</p>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <!-- Budget Slider Section -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Budget Configuration</h3>
        </div>
        <div class="budget-section">
          <div class="budget-display">
            <label for="budget-slider">Available Budget</label>
            <div class="budget-amount">{{ currencySymbol }}{{ selectedBudget.toLocaleString() }}</div>
          </div>
          <input
            id="budget-slider"
            v-model.number="selectedBudget"
            type="range"
            min="20000"
            max="200000"
            step="5000"
            class="budget-slider"
          />
          <div class="budget-range-labels">
            <span>{{ currencySymbol }}20K</span>
            <span>{{ currencySymbol }}200K</span>
          </div>
        </div>
      </div>

      <!-- Recommendations Section -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            Recommended Items
            <span class="item-count">({{ recommendations.length }} items)</span>
          </h3>
        </div>

        <div v-if="recommendations.length === 0" class="no-recommendations">
          <p>No items recommended for restocking based on current filters.</p>
        </div>
        <div v-else>
          <div class="table-container">
            <table class="recommendations-table">
              <thead>
                <tr>
                  <th class="col-select"><input v-model="selectAll" type="checkbox" class="select-all-checkbox" /></th>
                  <th class="col-sku">SKU</th>
                  <th class="col-name">Item Name</th>
                  <th class="col-category">Category</th>
                  <th class="col-current">Current Qty</th>
                  <th class="col-demand">Demand (30d)</th>
                  <th class="col-recommended">Qty to Order</th>
                  <th class="col-unit-cost">Unit Cost</th>
                  <th class="col-total">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in recommendations" :key="item.id" :class="{ selected: selectedItems.has(item.id) }">
                  <td class="col-select">
                    <input
                      v-model="selectedItems"
                      :value="item.id"
                      type="checkbox"
                      class="item-checkbox"
                    />
                  </td>
                  <td class="col-sku"><strong>{{ item.sku }}</strong></td>
                  <td class="col-name">{{ item.name }}</td>
                  <td class="col-category">{{ item.category }}</td>
                  <td class="col-current">{{ item.quantity_on_hand }}</td>
                  <td class="col-demand">{{ item.forecasted_30d }}</td>
                  <td class="col-recommended"><strong>{{ item.recommended_quantity }}</strong></td>
                  <td class="col-unit-cost">{{ currencySymbol }}{{ item.unit_cost.toFixed(2) }}</td>
                  <td class="col-total"><strong>{{ currencySymbol }}{{ (item.recommended_quantity * item.unit_cost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Order Summary -->
          <div class="order-summary">
            <div class="summary-row">
              <span class="summary-label">Items Selected:</span>
              <span class="summary-value">{{ selectedCount }} / {{ recommendations.length }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Order Total Cost:</span>
              <span class="summary-value" :class="{ 'over-budget': selectedTotal > selectedBudget }">
                {{ currencySymbol }}{{ selectedTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}
              </span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Remaining Budget:</span>
              <span class="summary-value" :class="{ 'negative': selectedBudget - selectedTotal < 0 }">
                {{ currencySymbol }}{{ (selectedBudget - selectedTotal).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}
              </span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="action-buttons">
            <button
              @click="placeOrder"
              :disabled="selectedCount === 0 || selectedTotal > selectedBudget"
              class="btn btn-primary"
            >
              Place Order
            </button>
            <button @click="clearSelection" class="btn btn-secondary">
              Clear Selection
            </button>
          </div>

          <!-- Success Message -->
          <div v-if="successMessage" class="success-message">
            {{ successMessage }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api'
import { useFilters } from '../composables/useFilters'
import { useRestockingOrders } from '../composables/useRestockingOrders'
import { useI18n } from '../composables/useI18n'

export default {
  name: 'Restocking',
  setup() {
    const { t, currentCurrency } = useI18n()
    const { selectedLocation, selectedCategory, getCurrentFilters } = useFilters()
    const { addRestockingOrder } = useRestockingOrders()

    const currencySymbol = computed(() => {
      return currentCurrency.value === 'JPY' ? '¥' : '$'
    })

    // State
    const loading = ref(true)
    const error = ref(null)
    const inventory = ref([])
    const demandForecasts = ref([])
    const selectedBudget = ref(100000) // Default $100K
    const selectedItems = ref(new Set())
    const selectAll = ref(false)
    const successMessage = ref('')

    // Load data on mount
    const loadData = async () => {
      try {
        loading.value = true
        error.value = null
        successMessage.value = ''

        const filters = getCurrentFilters()
        const [inventoryData, demandData] = await Promise.all([
          api.getInventory(filters),
          api.getDemandForecasts()
        ])

        inventory.value = inventoryData
        demandForecasts.value = demandData
      } catch (err) {
        error.value = 'Failed to load data: ' + err.message
        console.error('Load error:', err)
      } finally {
        loading.value = false
      }
    }

    // Build recommendations based on lowest current inventory + high demand
    const recommendations = computed(() => {
      const recs = []

      // Create a map of demand by SKU for quick lookup
      const demandMap = {}
      demandForecasts.value.forEach(d => {
        demandMap[d.item_sku] = d
      })

      // Filter inventory items that have low or adequate stock
      inventory.value.forEach(item => {
        const demand = demandMap[item.sku]
        
        // Only recommend items that are low or adequate stock
        // (quantity_on_hand <= reorder_point * 1.5)
        if (item.quantity_on_hand > item.reorder_point * 1.5) {
          return // Skip items with good stock
        }

        // Calculate 30-day forecasted demand (use current_demand as proxy for 30d)
        const forecasted30d = demand ? Math.ceil(demand.current_demand * 1.2) : item.reorder_point

        // Calculate recommended quantity: forecasted demand - current on hand, with 20% safety buffer
        let recommendedQty = forecasted30d - item.quantity_on_hand
        recommendedQty = Math.max(0, recommendedQty)
        recommendedQty = Math.ceil(recommendedQty * 1.2) // Add 20% safety stock

        // Calculate cost
        const totalCost = recommendedQty * item.unit_cost

        // Create recommendation object with priority score for sorting
        // Priority = demand / inventory ratio (higher = more critical to restock)
        const priorityScore = forecasted30d / Math.max(item.quantity_on_hand, 1)

        recs.push({
          id: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          quantity_on_hand: item.quantity_on_hand,
          reorder_point: item.reorder_point,
          unit_cost: item.unit_cost,
          forecasted_30d: forecasted30d,
          recommended_quantity: recommendedQty,
          total_cost: totalCost,
          priority_score: priorityScore
        })
      })

      // Sort by priority score descending (most critical first)
      return recs.sort((a, b) => b.priority_score - a.priority_score)
    })

    // Count selected items
    const selectedCount = computed(() => {
      return selectedItems.value.size
    })

    // Calculate total cost of selected items
    const selectedTotal = computed(() => {
      let total = 0
      selectedItems.value.forEach(itemId => {
        const item = recommendations.value.find(r => r.id === itemId)
        if (item) {
          total += item.total_cost
        }
      })
      return total
    })

    // Handle select all checkbox
    watch(selectAll, (newVal) => {
      if (newVal) {
        selectedItems.value = new Set(recommendations.value.map(r => r.id))
      } else {
        selectedItems.value.clear()
      }
    })

    // Watch selectedItems to update selectAll checkbox state
    watch(selectedItems, (newVal) => {
      selectAll.value = newVal.size === recommendations.value.length && recommendations.value.length > 0
    }, { deep: true })

    // Watch filters and reload data
    watch([selectedLocation, selectedCategory], () => {
      loadData()
    })

    // Place order
    const placeOrder = () => {
      if (selectedCount.value === 0 || selectedTotal.value > selectedBudget.value) {
        return
      }

      try {
        // Get selected item details
        const selectedItemDetails = recommendations.value
          .filter(r => selectedItems.value.has(r.id))
          .map(r => ({
            sku: r.sku,
            name: r.name,
            quantity: r.recommended_quantity,
            unit_cost: r.unit_cost
          }))

        // Submit order through composable
        const order = addRestockingOrder(
          selectedItemDetails,
          selectedTotal.value,
          selectedBudget.value
        )

        // Show success and reset form
        successMessage.value = `Order submitted successfully (Order #${order.order_number}). View in Orders tab to track delivery.`
        selectedItems.value.clear()
        selectAll.value = false

        // Clear success message after 5 seconds
        setTimeout(() => {
          successMessage.value = ''
        }, 5000)
      } catch (err) {
        error.value = 'Failed to submit order: ' + err.message
        console.error('Order submission error:', err)
      }
    }

    // Clear selection
    const clearSelection = () => {
      selectedItems.value.clear()
      selectAll.value = false
    }

    onMounted(loadData)

    return {
      t,
      loading,
      error,
      recommendations,
      selectedBudget,
      selectedItems,
      selectAll,
      selectedCount,
      selectedTotal,
      successMessage,
      currencySymbol,
      placeOrder,
      clearSelection
    }
  }
}
</script>

<style scoped>
.restocking {
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h2 {
  font-size: 1.75rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.5rem;
}

.page-header p {
  font-size: 0.95rem;
  color: #6b7280;
  line-height: 1.6;
}

.card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.card-header {
  padding: 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.item-count {
  font-size: 0.9rem;
  font-weight: 400;
  color: #6b7280;
  margin-left: 0.5rem;
}

/* Budget Section */
.budget-section {
  padding: 2rem;
}

.budget-display {
  margin-bottom: 1.5rem;
}

.budget-display label {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.budget-amount {
  font-size: 2rem;
  font-weight: 700;
  color: #0f172a;
}

.budget-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.budget-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.budget-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.budget-range-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: #6b7280;
}

/* Recommendations Table */
.table-container {
  overflow-x: auto;
}

.recommendations-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.recommendations-table thead {
  background: #f3f4f6;
  border-bottom: 2px solid #e5e7eb;
}

.recommendations-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
}

.recommendations-table tbody tr {
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.15s;
}

.recommendations-table tbody tr:hover {
  background: #f9fafb;
}

.recommendations-table tbody tr.selected {
  background: #eff6ff;
}

.recommendations-table td {
  padding: 1rem;
}

/* Column widths */
.col-select { width: 50px; }
.col-sku { width: 100px; }
.col-name { width: 150px; }
.col-category { width: 120px; }
.col-current { width: 120px; text-align: center; }
.col-demand { width: 120px; text-align: center; }
.col-recommended { width: 130px; text-align: center; }
.col-unit-cost { width: 110px; text-align: right; }
.col-total { width: 120px; text-align: right; }

input[type="checkbox"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
  accent-color: #3b82f6;
}

.select-all-checkbox {
  cursor: pointer;
}

/* Order Summary */
.order-summary {
  padding: 1.5rem 2rem;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.95rem;
}

.summary-label {
  font-weight: 500;
  color: #374151;
}

.summary-value {
  font-weight: 600;
  color: #111827;
  font-size: 1.05rem;
}

.summary-value.over-budget {
  color: #dc2626;
}

.summary-value.negative {
  color: #dc2626;
}

/* Action Buttons */
.action-buttons {
  padding: 1.5rem 2rem;
  display: flex;
  gap: 1rem;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}

/* Messages */
.loading, .error {
  padding: 1.5rem;
  text-align: center;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.loading {
  background: #eff6ff;
  color: #1e40af;
}

.error {
  background: #fee2e2;
  color: #991b1b;
}

.success-message {
  padding: 1rem;
  margin-top: 1rem;
  background: #dcfce7;
  color: #166534;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
}

.no-recommendations {
  padding: 3rem 2rem;
  text-align: center;
  color: #6b7280;
}
</style>
