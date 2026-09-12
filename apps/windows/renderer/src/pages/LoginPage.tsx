import React from 'react';
import { useNavigate } from 'react-router-dom';
import ComicPanel from '../components/ui/ComicPanel';
import ComicButton from '../components/ui/ComicButton';
import ComicInput from '../components/ui/ComicInput';
import Logo from '../components/ui/Logo';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder login
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo className="text-4xl" />
        </div>
        
        <ComicPanel title="AUTHENTICATION REQUIRED">
          <form onSubmit={handleLogin} className="flex flex-col gap-6 mt-4">
            <ComicInput 
              label="Email Address" 
              type="email" 
              placeholder="agent@comiclink.hq" 
              required
            />
            <ComicInput 
              label="Passcode" 
              type="password" 
              placeholder="••••••••" 
              required
            />
            
            <div className="pt-2">
              <ComicButton type="submit" className="w-full h-12 flex justify-center gap-2">
                <LogIn className="w-5 h-5" />
                ENTER SYSTEM
              </ComicButton>
            </div>
          </form>
        </ComicPanel>
      </div>
    </div>
  );
}
