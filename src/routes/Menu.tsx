import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CategoryTab from "@/routes/menu/CategoryTab"
import ProductTab from "@/routes/menu/ProductTab"
import ToppingTab from "@/routes/menu/ToppingTab"

export default function Menu() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Quản lý Menu</h1>
        <Button className="h-11" variant="outline" asChild>
          <Link to="/">Về trang chủ</Link>
        </Button>
      </div>

      <Tabs defaultValue="categories">
        <TabsList className="h-11">
          <TabsTrigger className="px-4" value="categories">
            Danh mục
          </TabsTrigger>
          <TabsTrigger className="px-4" value="products">
            Món
          </TabsTrigger>
          <TabsTrigger className="px-4" value="toppings">
            Topping
          </TabsTrigger>
        </TabsList>
        <TabsContent value="categories">
          <CategoryTab />
        </TabsContent>
        <TabsContent value="products">
          <ProductTab />
        </TabsContent>
        <TabsContent value="toppings">
          <ToppingTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
