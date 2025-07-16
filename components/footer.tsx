import { Star } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-900 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-2">© 2025 DataWiz. All rights reserved.</p>
          <p className="text-xs text-gray-500">
            <a href="https://github.com/AmanVattoli/DataWiz" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors duration-200">
              Developed by Aman Vattoli
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
