export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
            Nepathya Ticket System
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            QR-based event ticket verification system
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Admin Access</h2>
            <div className="space-y-2">
              <a
                href="/admin/login"
                className="block w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Admin Login
              </a>
              <a
                href="/scan"
                className="block w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors"
              >
                QR Scanner
              </a>
              <a
                href="/admin/tickets"
                className="block w-full bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Manage Tickets
              </a>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Links</h2>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600">
                <strong>Sample ticket URL:</strong><br />
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  /entry/[your-token]
                </code>
              </p>
              <p className="text-gray-600">
                <strong>Default admin credentials:</strong><br />
                Email: admin@example.com<br />
                Password: admin123
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 text-xs text-gray-500">
          <p>
            Generate tokens using: <code>npm run generate-tokens</code><br />
            Seed admin using: <code>npm run seed-admin</code>
          </p>
        </div>
      </div>
    </div>
  );
}