export default function Offline() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Offline</h1>
        <p className="text-slate-600 mb-6">
          You're currently offline. Some features may not be available until you reconnect to the internet.
        </p>
        <p className="text-sm text-slate-500">
          Your recent data has been cached and will be available when you're online again.
        </p>
      </div>
    </div>
  )
}
