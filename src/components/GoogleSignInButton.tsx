import type { User } from 'firebase/auth';
import { LogOut } from 'lucide-react';

interface GoogleSignInButtonProps {
  user: User | null;
  hasAccessToken: boolean;
  loading?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  compact?: boolean;
}

export function GoogleSignInButton({
  user,
  hasAccessToken,
  loading = false,
  onSignIn,
  onSignOut,
  compact = false,
}: GoogleSignInButtonProps) {
  if (user && hasAccessToken) {
    return (
      <div className="inline-flex items-center gap-2 border border-emerald-400 bg-emerald-50 px-2.5 py-1.5 text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
        <span className="font-bold text-emerald-950 truncate max-w-[190px]">
          {user.email || user.displayName || 'Google Connected'}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          title="Disconnect Google account"
          aria-label="Sign out of Google"
          className="p-1 text-emerald-900 hover:text-red-700"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSignIn}
      disabled={loading}
      aria-label="Sign in with Google"
      className={`inline-flex items-center gap-2.5 bg-white border border-[#747775] rounded-[4px] font-medium text-[#1f1f1f] hover:bg-[#f8f9fa] hover:shadow-xs disabled:opacity-50 ${
        compact ? 'h-[36px] px-3 text-xs' : 'h-[40px] px-3.5 text-[13px]'
      }`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 48 48"
        aria-hidden="true"
        className="shrink-0 block"
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      <span>{loading ? 'Connecting…' : user ? 'Reconnect Google Sheets' : 'Sign in with Google'}</span>
    </button>
  );
}
