import { forwardRef } from 'react'
import Image, { type ImageProps } from 'next/image'
import { cn } from '@/lib/utils'

const Avatar = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
      className
    )}
    {...props}
  />
))
Avatar.displayName = 'Avatar'

interface AvatarImageProps extends Omit<ImageProps, 'className' | 'fill'> {
  className?: string
  imageClassName?: string
}

const AvatarImage = forwardRef<HTMLSpanElement, AvatarImageProps>(
  ({ className, imageClassName, alt, ...props }, ref) => (
    <span
      ref={ref}
      className={cn('relative block h-full w-full overflow-hidden rounded-full', className)}
    >
      <Image
        fill
        sizes="40px"
        alt={alt}
        className={cn('object-cover', imageClassName)}
        {...props}
      />
    </span>
  )
)
AvatarImage.displayName = 'AvatarImage'

const AvatarFallback = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600',
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = 'AvatarFallback'

export { Avatar, AvatarImage, AvatarFallback }
