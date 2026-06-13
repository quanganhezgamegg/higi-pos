import { createHashRouter, RouterProvider } from "react-router-dom"
import Home from "@/routes/Home"
import Settings from "@/routes/Settings"

const router = createHashRouter([
  { path: "/", element: <Home /> },
  { path: "/settings", element: <Settings /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
