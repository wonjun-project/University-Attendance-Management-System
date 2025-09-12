import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
        secondary: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        success: 'bg-success-100 text-success-800 hover:bg-success-200',
        warning: 'bg-warning-100 text-warning-800 hover:bg-warning-200',
        error: 'bg-error-100 text-error-800 hover:bg-error-200',
        primary: 'bg-primary-100 text-primary-800 hover:bg-primary-200',
        outline: 'border border-gray-200 text-gray-600 hover:bg-gray-50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }