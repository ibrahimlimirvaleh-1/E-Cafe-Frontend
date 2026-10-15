import { Navigate } from 'react-router-dom'

export function WaiterOrdersPage() {
  return <Navigate to="/waiter?view=tables" replace />
}
