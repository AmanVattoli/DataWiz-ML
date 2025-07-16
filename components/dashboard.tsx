"use client"

import { useState, forwardRef, useImperativeHandle } from "react"
import { CleanDataTab } from "@/components/clean-data-tab"
import { Card, CardContent } from "@/components/ui/card"
import { useDataContext } from "@/components/data-context"

export interface DashboardRef {
  setActiveTab: (tab: string) => void
}

export const Dashboard = forwardRef<DashboardRef>((props, ref) => {
  const [activeTab, setActiveTab] = useState("clean")
  const { fileData } = useDataContext()

  useImperativeHandle(ref, () => ({
    setActiveTab
  }))

  // If no file is uploaded, show upload message
  if (!fileData) {
    return (
      <section className="py-16 px-4 bg-gray-800/50">
        <div className="container mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-600">Please upload a file first</p>
            </CardContent>
          </Card>
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 px-4 bg-gray-800/50">
      <div className="container mx-auto">
        <CleanDataTab />
      </div>
    </section>
  )
})

Dashboard.displayName = "Dashboard"
