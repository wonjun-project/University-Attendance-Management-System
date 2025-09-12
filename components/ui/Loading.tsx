import { cn } from '@/lib/utils'

interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'spinner' | 'dots' | 'pulse'
}

const Loading = ({ 
  size = 'md', 
  variant = 'spinner', 
  className, 
  ...props 
}: LoadingProps) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  if (variant === 'spinner') {
    return (
      <div
        className={cn('flex items-center justify-center', className)}
        {...props}
      >
        <svg
          className={cn(
            'animate-spin text-primary-600',
            sizes[size]
          )}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    )
  }

  if (variant === 'dots') {
    return (
      <div
        className={cn('flex space-x-1', className)}
        {...props}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'bg-primary-600 rounded-full animate-pulse',
              size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
            )}
            style={{
              animationDelay: `${i * 0.1}s`,
              animationDuration: '1s'
            }}
          />
        ))}
      </div>
    )
  }

  if (variant === 'pulse') {
    return (
      <div
        className={cn(
          'bg-gray-200 rounded-md animate-pulse',
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }

  return null
}

const LoadingPage = ({ message = '로딩 중...' }: { message?: string }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
      <Loading size="lg" />
      <p className="text-gray-600 text-sm">{message}</p>
    </div>
  )
}

export { Loading, LoadingPage }