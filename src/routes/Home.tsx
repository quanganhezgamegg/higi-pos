import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">HiGi POS</h1>
      <Button asChild>
        <Link to="/settings">Mở Cài đặt</Link>
      </Button>
    </div>
  )
}
