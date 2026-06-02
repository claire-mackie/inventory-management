import { ref, computed } from 'vue'

// In-memory storage for submitted restocking orders
// Each order contains: id, items (array of {sku, name, quantity, unit_cost}), 
// totalCost, budget, submittedDate, expectedDelivery
const submittedOrders = ref([])

export function useRestockingOrders() {
  // Calculate expected delivery date based on lead time
  // Using 5-7 business days as standard lead time
  const calculateExpectedDelivery = () => {
    const today = new Date()
    // Add 6 days (roughly 5-7 business days accounting for weekends)
    const deliveryDate = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000)
    return deliveryDate.toISOString().split('T')[0]
  }

  // Add a new restocking order
  const addRestockingOrder = (items, totalCost, budget) => {
    const orderId = 'RSK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    
    const newOrder = {
      id: orderId,
      order_number: orderId,
      customer: 'Internal Restocking',
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_cost
      })),
      status: 'Processing',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery: calculateExpectedDelivery(),
      total_value: totalCost,
      warehouse: 'All Warehouses',
      category: 'Restocking'
    }

    submittedOrders.value.unshift(newOrder)
    return newOrder
  }

  // Get all submitted restocking orders
  const getSubmittedOrders = () => {
    return submittedOrders.value
  }

  // Get submitted orders count
  const submittedOrdersCount = computed(() => {
    return submittedOrders.value.length
  })

  return {
    submittedOrders,
    addRestockingOrder,
    getSubmittedOrders,
    submittedOrdersCount
  }
}
