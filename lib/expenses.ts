export interface Expense {
  id: string
  description: string
  amount: number
  date: string
  category: string
  createdAt?: string
}

export const getExpenses = (): Expense[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem("yellowbell_expenses")
  return stored ? JSON.parse(stored) : []
}

export const addExpense = (expense: Omit<Expense, "id" | "createdAt">): Expense => {
  if (typeof window === "undefined") return {} as Expense
  
  const newExpense: Expense = {
    ...expense,
    id: `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString()
  }
  
  const expenses = getExpenses()
  expenses.push(newExpense)
  localStorage.setItem("yellowbell_expenses", JSON.stringify(expenses))
  window.dispatchEvent(new Event("expenses-updated"))
  
  return newExpense
}

export const deleteExpense = (expenseId: string): void => {
  if (typeof window === "undefined") return
  
  const expenses = getExpenses()
  const updatedExpenses = expenses.filter(expense => expense.id !== expenseId)
  localStorage.setItem("yellowbell_expenses", JSON.stringify(updatedExpenses))
  window.dispatchEvent(new Event("expenses-updated"))
}

export const updateExpense = (expenseId: string, updates: Partial<Expense>): Expense | null => {
  if (typeof window === "undefined") return null
  
  const expenses = getExpenses()
  const expenseIndex = expenses.findIndex(expense => expense.id === expenseId)
  
  if (expenseIndex === -1) return null
  
  expenses[expenseIndex] = { ...expenses[expenseIndex], ...updates }
  localStorage.setItem("yellowbell_expenses", JSON.stringify(expenses))
  window.dispatchEvent(new Event("expenses-updated"))
  
  return expenses[expenseIndex]
}

export const getExpensesByDateRange = (startDate: Date, endDate: Date): Expense[] => {
  const expenses = getExpenses()
  return expenses.filter(expense => {
    const expenseDate = new Date(expense.date)
    return expenseDate >= startDate && expenseDate <= endDate
  })
}

export const getExpenseCategories = (): string[] => {
  const expenses = getExpenses()
  const categories = new Set(expenses.map(expense => expense.category))
  return Array.from(categories).sort()
}
