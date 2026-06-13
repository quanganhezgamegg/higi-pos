import { createBrowserRouter, RouterProvider } from "react-router-dom"
import Home from "@/routes/Home"
import Settings from "@/routes/Settings"

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/settings", element: <Settings /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
