"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { User, Mail, Calendar, Save } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

interface UserProfile {
  id: string
  name: string
  email: string
  image: string
  createdAt: string
  lastLogin: string
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [name, setName] = useState("")

  useEffect(() => {
    if (status === "authenticated") {
      fetchProfile()
    } else if (status === "unauthenticated") {
      setLoading(false)
    }
  }, [status])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const data = await response.json()
        setProfile(data)
        setName(data.name)
      } else {
        toast.error("Failed to load profile")
      }
    } catch (error) {
      toast.error("Error loading profile")
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async () => {
    if (!name.trim()) {
      toast.error("Name cannot be empty")
      return
    }

    setUpdating(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (response.ok) {
        toast.success("Profile updated successfully")
        fetchProfile() // Refresh profile data
      } else {
        toast.error("Failed to update profile")
      }
    } catch (error) {
      toast.error("Error updating profile")
    } finally {
      setUpdating(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto space-y-6">
            <Skeleton className="h-8 w-48 bg-gray-700" />
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <Skeleton className="h-6 w-32 bg-gray-700" />
                <Skeleton className="h-4 w-64 bg-gray-700" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-20 w-20 rounded-full bg-gray-700" />
                <Skeleton className="h-4 w-full bg-gray-700" />
                <Skeleton className="h-4 w-3/4 bg-gray-700" />
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-8">You need to sign in to view your profile.</p>
          <Button onClick={() => window.location.href = '/auth/signin'}>
            Sign In
          </Button>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-serif font-bold text-white mb-8">
            Your Profile
          </h1>

          <Card className="rounded-2xl shadow-lg border border-gray-700 bg-gray-800/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white font-serif">Profile Information</CardTitle>
              <CardDescription className="text-gray-400">
                Manage your account details and preferences
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.image || session?.user?.image || ""} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 via-purple-500 to-teal-500 text-white text-xl">
                    {profile?.name?.charAt(0) || session?.user?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-medium text-white">{profile?.name || session?.user?.name}</h3>
                  <p className="text-sm text-gray-400">Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Recently'}</p>
                </div>
              </div>

              {/* Profile Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-300">
                    <User className="w-4 h-4 inline mr-2" />
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white"
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email Address
                  </Label>
                  <Input
                    value={profile?.email || session?.user?.email || ""}
                    disabled
                    className="bg-gray-700 border-gray-600 text-gray-400"
                  />
                  <p className="text-xs text-gray-500">Email cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Last Login
                  </Label>
                  <Input
                    value={profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : "Recently"}
                    disabled
                    className="bg-gray-700 border-gray-600 text-gray-400"
                  />
                </div>

                <Button
                  onClick={updateProfile}
                  disabled={updating || name === profile?.name}
                  className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 hover:from-blue-700 hover:via-purple-700 hover:to-teal-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updating ? "Updating..." : "Update Profile"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  )
} 