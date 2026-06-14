import { createHashRouter, RouterProvider } from "react-router-dom"
import Home from "@/routes/Home"
import Menu from "@/routes/Menu"
import Settings from "@/routes/Settings"
import Tables from "@/routes/Tables"

const router = createHashRouter([
  { path: "/", element: <Home /> },
  { path: "/menu", element: <Menu /> },
  { path: "/tables", element: <Tables /> },
  { path: "/settings", element: <Settings /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
