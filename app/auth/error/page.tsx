"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "Configuration":
        return "There is a problem with the server configuration."
      case "AccessDenied":
        return "Access denied. You do not have permission to sign in."
      case "Verification":
        return "The verification token has expired or has already been used."
      default:
        return "An error occurred during authentication."
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <Card className="w-full max-w-md rounded-lg shadow-2xl border border-red-700 bg-gray-800">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-lg bg-red-600 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Authentication Error
          </CardTitle>
          <CardDescription className="text-gray-400">
            {getErrorMessage(error)}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-400">
              Error code: {error || "Unknown"}
            </p>
            
            <div className="space-y-3">
              <Link href="/auth/signin">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                  Try Again
                </Button>
              </Link>
              
              <Link href="/">
                <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 rounded-lg">
                  Go Home
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <Card className="w-full max-w-md rounded-lg shadow-2xl border border-red-700 bg-gray-800">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-lg bg-red-600 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Loading...
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
} 