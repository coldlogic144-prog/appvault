import ComicPanel from '../components/ui/ComicPanel';
import SpeechBubble from '../components/ui/SpeechBubble';
import { MessageSquare } from 'lucide-react';
import ComicInput from '../components/ui/ComicInput';
import ComicButton from '../components/ui/ComicButton';

export default function ChatPage() {
  return (
    <div className="flex flex-col gap-6 h-full">
      <h1 className="text-3xl font-black uppercase text-text tracking-wider flex items-center gap-3">
        <MessageSquare className="w-8 h-8 text-accent-blue" />
        Secure Comms
      </h1>
      
      <ComicPanel title="TRANSMISSION LOG" className="flex-1 flex flex-col p-0 overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          <SpeechBubble direction="left" className="self-start max-w-[80%]">
            <p className="font-bold text-accent-blue mb-1 text-sm uppercase">HQ</p>
            <p>Connection established. Ready to receive transmissions.</p>
          </SpeechBubble>
          
          <SpeechBubble direction="right" className="self-end max-w-[80%]">
            <p className="font-bold text-accent-red mb-1 text-sm uppercase text-right">You</p>
            <p>Copy that. Initiating data sync.</p>
          </SpeechBubble>
        </div>
        
        <div className="p-4 border-t-4 border-ink bg-panel flex gap-4">
          <div className="flex-1">
            <ComicInput placeholder="Type your message..." className="w-full" />
          </div>
          <ComicButton variant="primary">SEND</ComicButton>
        </div>
      </ComicPanel>
    </div>
  );
}
