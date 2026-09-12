import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ComicPanel from '../components/ui/ComicPanel';
import ComicButton from '../components/ui/ComicButton';
import SpeechBubble from '../components/ui/SpeechBubble';
import { getPairedDevices } from '../services/pairing';
import { getPublicProfile } from '../services/auth';
import {
  getOrCreateConversation,
  sendChatMessage,
  listenToConversationMessages
} from '../services/chat';
import type { PairedDevice, ChatMessage } from '@comiclink/shared-types';
import {
  MessageSquare,
  Send,
  Radio,
  Users,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  UserCheck
} from 'lucide-react';

interface PairedContact {
  pairId: string;
  peerUid: string;
  peerDisplayName: string;
  deviceName: string;
  status: 'active';
}

export default function ChatPage() {
  const { currentUser } = useAuth();

  const [contacts, setContacts] = useState<PairedContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<PairedContact | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages feed to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load paired contacts
  const loadContacts = async () => {
    if (!currentUser) return;
    setIsLoadingContacts(true);
    setErrorBanner(null);

    try {
      const paired = await getPairedDevices(currentUser.uid);
      const contactList: PairedContact[] = [];

      for (const pair of paired) {
        if (pair.status !== 'active') continue;

        const anyPair = pair as PairedDevice & { userA?: string; userB?: string };
        const isUserA = anyPair.userA === currentUser.uid;
        const peerUid = isUserA
          ? (anyPair.userB || pair.ownerUid)
          : (anyPair.userA || pair.ownerUid);

        // Disallow self-chatting
        if (peerUid === currentUser.uid) continue;

        let peerDisplayName = isUserA ? pair.deviceNameB : pair.deviceNameA;
        try {
          const profile = await getPublicProfile(peerUid);
          if (profile?.displayName) {
            peerDisplayName = profile.displayName;
          }
        } catch {
          // Fall back to device name if profile read fails
        }

        contactList.push({
          pairId: pair.pairId,
          peerUid,
          peerDisplayName: peerDisplayName || 'Field Operative',
          deviceName: isUserA ? pair.deviceNameB : pair.deviceNameA,
          status: 'active'
        });
      }

      setContacts(contactList);

      // Preserve or auto-select first contact
      if (contactList.length > 0 && !selectedContact) {
        handleSelectContact(contactList[0]!);
      }
    } catch (err: any) {
      console.error('[ChatPage] Failed to load paired contacts:', err);
      setErrorBanner('Failed to load paired contacts roster.');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [currentUser]);

  // Select contact & initiate/retrieve conversation
  const handleSelectContact = async (contact: PairedContact) => {
    setSelectedContact(contact);
    setIsLoadingConversation(true);
    setErrorBanner(null);
    setMessages([]);

    try {
      const conv = await getOrCreateConversation(contact.peerUid, contact.pairId);
      setActiveConversationId(conv.conversationId);
    } catch (err: any) {
      console.error('[ChatPage] Failed to get/create conversation:', err);
      setErrorBanner(err.message || 'Unable to establish secure conversation channel.');
    } finally {
      setIsLoadingConversation(false);
    }
  };

  // Realtime subscription to messages
  useEffect(() => {
    if (!activeConversationId) return;

    const unsubscribe = listenToConversationMessages(
      activeConversationId,
      (incoming) => {
        setMessages(incoming);
      },
      (err) => {
        setErrorBanner(err.message || 'Transmission channel interrupted.');
      }
    );

    return () => unsubscribe();
  }, [activeConversationId]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConversationId || !messageText.trim() || isSending) return;

    const textToSend = messageText.trim();
    if (textToSend.length > 2000) {
      setErrorBanner('Transmission exceeds maximum length of 2,000 characters.');
      return;
    }

    setIsSending(true);
    setErrorBanner(null);

    try {
      await sendChatMessage(activeConversationId, textToSend);
      setMessageText('');
    } catch (err: any) {
      console.error('[ChatPage] Send failed:', err);
      setErrorBanner(err.message || 'Failed to dispatch transmission.');
    } finally {
      setIsSending(false);
    }
  };

  // Format message time
  const formatTime = (createdAt: any) => {
    if (!createdAt) return 'TRANSMITTING...';
    try {
      const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt.seconds * 1000);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-6.5rem)]">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black uppercase text-text tracking-wider flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-accent-blue" />
          Secure Comms
        </h1>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-ink border-2 border-border text-xs font-bold uppercase text-accent-blue rounded">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            1-to-1 Encrypted Session
          </span>
          <ComicButton variant="ghost" size="sm" onClick={loadContacts} disabled={isLoadingContacts}>
            <RefreshCw className={`w-4 h-4 ${isLoadingContacts ? 'animate-spin' : ''}`} />
          </ComicButton>
        </div>
      </div>

      {/* Error Banner */}
      {errorBanner && (
        <div className="bg-accent-red/20 border-2 border-accent-red p-3 rounded flex items-center gap-3 text-text text-sm font-bold">
          <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0" />
          <span className="flex-1">{errorBanner}</span>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-text-muted hover:text-text uppercase text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dual Panel Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left Column: Paired Contacts Roster */}
        <ComicPanel title="PAIRED OPERATIVES" className="flex flex-col p-0 overflow-hidden h-full">
          <div className="p-3 bg-ink/50 border-b-2 border-ink flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Active Links ({contacts.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {isLoadingContacts && contacts.length === 0 ? (
              <div className="p-6 text-center text-text-muted text-sm font-bold animate-pulse">
                Scanning secure frequencies...
              </div>
            ) : contacts.length === 0 ? (
              <div className="p-6 text-center text-text-muted flex flex-col items-center gap-3">
                <ShieldCheck className="w-10 h-10 text-border" />
                <p className="text-xs font-bold uppercase tracking-wide">No active paired operatives</p>
                <p className="text-xs text-text-muted">
                  Pair your station with another operative in the Devices / Pairing panel to initiate communications.
                </p>
              </div>
            ) : (
              contacts.map((contact) => {
                const isSelected = selectedContact?.pairId === contact.pairId;
                return (
                  <button
                    key={contact.pairId}
                    onClick={() => handleSelectContact(contact)}
                    className={`text-left p-3 rounded border-2 transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'border-accent-blue bg-accent-blue/15 comic-shadow'
                        : 'border-border bg-ink hover:border-text-muted/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm uppercase tracking-wide text-text flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-accent-blue" />
                        {contact.peerDisplayName}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-ink border border-accent-blue/40 text-accent-blue rounded uppercase">
                        Active
                      </span>
                    </div>
                    <div className="text-xs text-text-muted truncate">
                      Station: {contact.deviceName}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ComicPanel>

        {/* Right Column: Active Conversation Log & Dispatch */}
        <ComicPanel
          title={
            selectedContact
              ? `TRANSMISSION FEED // ${selectedContact.peerDisplayName}`
              : 'TRANSMISSION FEED'
          }
          className="md:col-span-2 flex flex-col p-0 overflow-hidden h-full"
        >
          {selectedContact ? (
            <div className="flex flex-col h-full">
              {/* Channel Info Bar */}
              <div className="px-4 py-2 bg-ink/70 border-b-2 border-ink flex items-center justify-between text-xs font-bold text-text-muted">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-blue animate-ping" />
                  <span>TARGET: {selectedContact.peerDisplayName}</span>
                </span>
                <span className="font-mono text-[10px] uppercase text-text-muted">
                  PAIR: {selectedContact.pairId.slice(0, 16)}...
                </span>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
                {isLoadingConversation ? (
                  <div className="m-auto text-center text-text-muted text-sm font-bold animate-pulse">
                    Decrypting transmission log...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="m-auto text-center text-text-muted flex flex-col items-center gap-3">
                    <Radio className="w-12 h-12 text-border animate-pulse" />
                    <p className="text-sm font-black uppercase tracking-wider text-text">Frequency Open</p>
                    <p className="text-xs max-w-sm text-text-muted">
                      No transmissions recorded on this secure frequency yet. Send the first dispatch below.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.senderId === currentUser?.uid;
                    return (
                      <div
                        key={msg.messageId}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <SpeechBubble
                          direction={isSelf ? 'right' : 'left'}
                          className={`max-w-[85%] md:max-w-[75%] ${
                            isSelf
                              ? 'bg-panel border-accent-red/80'
                              : 'bg-panel border-accent-blue/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-1">
                            <span
                              className={`font-black text-xs uppercase tracking-wider ${
                                isSelf ? 'text-accent-red' : 'text-accent-blue'
                              }`}
                            >
                              {isSelf ? 'YOU' : selectedContact.peerDisplayName}
                            </span>
                            <span className="text-[10px] text-text-muted font-mono">
                              {formatTime(msg.createdAt)}
                            </span>
                          </div>
                          {/* Strict plain text rendering preventing any HTML execution */}
                          <p className="text-sm text-text whitespace-pre-wrap break-words leading-relaxed font-sans">
                            {msg.text}
                          </p>
                        </SpeechBubble>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Dispatch Bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-4 border-t-4 border-ink bg-panel flex flex-col gap-2"
              >
                <div className="flex gap-3 items-center">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={`Transmit to ${selectedContact.peerDisplayName}...`}
                      maxLength={2000}
                      disabled={isSending}
                      className="w-full bg-ink text-text border-2 border-border rounded px-4 py-2.5 text-sm font-sans focus:outline-none focus:border-accent-blue transition-colors placeholder:text-text-muted/60"
                    />
                  </div>
                  <ComicButton
                    variant="primary"
                    disabled={isSending || !messageText.trim() || messageText.trim().length > 2000}
                    className="flex items-center gap-2 px-5 py-2.5"
                  >
                    {isSending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>SEND</span>
                  </ComicButton>
                </div>
                <div className="flex items-center justify-between px-1 text-[11px] font-mono text-text-muted">
                  <span>Plain text dispatch only. Maximum 2,000 characters.</span>
                  <span
                    className={
                      messageText.length > 1900
                        ? 'text-accent-red font-bold'
                        : 'text-text-muted'
                    }
                  >
                    {messageText.length} / 2000
                  </span>
                </div>
              </form>
            </div>
          ) : (
            <div className="m-auto text-center p-12 flex flex-col items-center gap-4 text-text-muted">
              <Users className="w-16 h-16 text-border" />
              <h3 className="text-lg font-black uppercase text-text tracking-wide">
                No Operative Selected
              </h3>
              <p className="text-xs max-w-sm text-text-muted">
                Select an active operative link from the roster on the left to begin transmission.
              </p>
            </div>
          )}
        </ComicPanel>
      </div>
    </div>
  );
}
