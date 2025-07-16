import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import { MongoClient } from "mongodb"

// Check if MongoDB URI is provided
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/data-wiz'

console.log('MongoDB URI from env:', process.env.MONGODB_URI)
console.log('Using MongoDB URI:', mongoUri)

if (!process.env.MONGODB_URI) {
  console.warn('MONGODB_URI not found in environment variables, using fallback')
}

const client = new MongoClient(mongoUri)
const clientPromise = client.connect()

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: "database",
  },
} 