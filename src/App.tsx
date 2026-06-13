import { createHashRouter, RouterProvider } from "react-router-dom"
import Home from "@/routes/Home"
import Menu from "@/routes/Menu"
import Settings from "@/routes/Settings"

const router = createHashRouter([
  { path: "/", element: <Home /> },
  { path: "/menu", element: <Menu /> },
  { path: "/settings", element: <Settings /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
