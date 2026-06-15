import { createHashRouter, RouterProvider } from "react-router-dom"
import Home from "@/routes/Home"
import Menu from "@/routes/Menu"
import Payment from "@/routes/Payment"
import Reports from "@/routes/Reports"
import Sales from "@/routes/Sales"
import Settings from "@/routes/Settings"
import ShiftScreen from "@/routes/Shift"
import Tables from "@/routes/Tables"

const router = createHashRouter([
  { path: "/", element: <Home /> },
  { path: "/sales", element: <Sales /> },
  { path: "/payment/:orderId", element: <Payment /> },
  { path: "/shift", element: <ShiftScreen /> },
  { path: "/reports", element: <Reports /> },
  { path: "/menu", element: <Menu /> },
  { path: "/tables", element: <Tables /> },
  { path: "/settings", element: <Settings /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
