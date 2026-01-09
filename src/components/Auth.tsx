import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Heading, Input } from '@chakra-ui/react';
import { Field } from '@/components/ui/field';

export const Auth = () => {
  const { signInWithEmail, user, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setMessage('Please enter your email');
      return;
    }

    setLoading(true);
    setMessage('');

    const { error } = await signInWithEmail(email);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Check your email for the magic link!');
      setEmail('');
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setMessage('');
  };

  if (user) {
    return (
      <Card.Root className="w-full max-w-4xl shadow-xl border border-gray-700 transition-all duration-300 hover:border-gray-600">
        <Card.Body className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
              {user.email?.[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-gray-400">Signed in as</p>
              <p className="font-semibold">{user.email}</p>
            </div>
          </div>
          <Button
            onClick={handleSignOut}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Sign Out
          </Button>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root className="w-full max-w-4xl shadow-xl border border-gray-700 transition-all duration-300 hover:border-gray-600">
      <Card.Body className="flex flex-col gap-4">
        <div className="text-center">
          <Heading className="text-xl md:text-2xl font-bold text-gray-100">
            🔐 Sign In Required
          </Heading>
          <p className="text-sm text-gray-400 mt-2">
            Sign in to record match results and update player ratings
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Field label="Email Address">
            <Input
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full"
            />
          </Field>

          <Button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending magic link...' : '✨ Send Magic Link'}
          </Button>

          {message && (
            <div
              className={`p-3 rounded-lg text-sm text-center ${
                message.includes('Error')
                  ? 'bg-red-900/50 text-red-300'
                  : 'bg-green-900/50 text-green-300'
              }`}
            >
              {message}
            </div>
          )}
        </form>

        <div className="text-xs text-gray-500 text-center">
          <p>No password needed! We'll send you a magic link to sign in.</p>
          <p className="mt-1">The link expires after 1 hour.</p>
        </div>
      </Card.Body>
    </Card.Root>
  );
};
