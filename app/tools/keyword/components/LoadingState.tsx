interface LoadingStateProps {
  message: string
}

export default function LoadingState({ message }: LoadingStateProps) {
  return (
    <div className="p-6 flex flex-col items-center justify-center">
      <div className="h-10 w-10 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">{message || "載入中..."}</p>
    </div>
  )
}

