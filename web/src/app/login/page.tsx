import { LandingHeader } from '@/components/landing/Header';
import { AuthCard } from '@/components/login/AuthCard';

export default function LoginPage() {
  return (
    <div className='min-h-screen bg-gradient-to-b from-blue-500 via-blue-500 to-blue-400 overflow-hidden relative flex flex-col'>
      {/* Frosted glass effect */}
      <div className='absolute inset-0 backdrop-blur-md bg-white/10'></div>

      {/* Decorative elements */}
      <div className='absolute top-20 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl'></div>
      <div className='absolute bottom-20 right-10 w-80 h-80 bg-white/10 rounded-full blur-3xl'></div>

      {/* Header/Navigation */}
      <div className='w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 absolute top-0 left-0 right-0 z-20'>
        <LandingHeader />
      </div>

      {/* Login Card - Centered in the remaining space */}
      <div className='flex-1 flex items-center justify-center px-4 relative z-5'>
        <AuthCard />
      </div>
    </div>
  );
}
