import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Variantes gray/blue/purple/green/red/orange/yellow: patrón fijo del proyecto
// (bg-COLOR-100 text-COLOR-800 ring-COLOR-400 + bg-COLOR-500 para el dot).
// No reinventar este patrón al agregar variantes nuevas.
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-4xl border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "border-transparent hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
        gray: "border-transparent bg-gray-100 text-gray-800 ring-1 ring-inset ring-gray-400",
        blue: "border-transparent bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-400",
        purple: "border-transparent bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-400",
        green: "border-transparent bg-green-100 text-green-800 ring-1 ring-inset ring-green-400",
        red: "border-transparent bg-red-100 text-red-800 ring-1 ring-inset ring-red-400",
        orange: "border-transparent bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-400",
        yellow: "border-transparent bg-yellow-100 text-yellow-800 ring-1 ring-inset ring-yellow-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const dotColors = {
  default: "bg-primary-foreground",
  secondary: "bg-secondary-foreground",
  destructive: "bg-destructive",
  outline: "bg-foreground",
  ghost: "bg-muted-foreground",
  link: "bg-primary",
  gray: "bg-gray-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-green-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
} satisfies Record<NonNullable<VariantProps<typeof badgeVariants>["variant"]>, string>

function Badge({
  className,
  variant = "default",
  dot = false,
  render,
  children,
  ...props
}: useRender.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
        children: (
          <>
            {dot && <span className={cn("size-1.5 rounded-full", dotColors[variant ?? "default"])} />}
            {children}
          </>
        ),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
