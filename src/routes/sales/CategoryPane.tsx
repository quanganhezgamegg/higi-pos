import type { Category } from "@/lib/api/menu"
import { cn } from "@/lib/utils"

type CategoryPaneProps = {
  categories: Category[]
  activeCategoryId: number | null
  onSelect: (id: number | null) => void
}

export function CategoryPane({ activeCategoryId, categories, onSelect }: CategoryPaneProps) {
  return (
    <nav className="flex h-full w-[220px] shrink-0 flex-col gap-3 overflow-y-auto border-r bg-background p-5">
      <button
        className={cn(
          "min-h-14 rounded-2xl px-4 text-left font-bold transition-colors",
          activeCategoryId === null
            ? "bg-primary text-primary-foreground"
            : "border bg-white hover:bg-secondary hover:text-primary",
        )}
        onClick={() => onSelect(null)}
      >
        Tất cả
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          className={cn(
            "min-h-14 rounded-2xl px-4 text-left font-bold transition-colors",
            activeCategoryId === category.id
              ? "bg-primary text-primary-foreground"
              : "border bg-white hover:bg-secondary hover:text-primary",
          )}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
        </button>
      ))}
    </nav>
  )
}
