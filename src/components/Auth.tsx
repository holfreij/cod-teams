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
      setMessage('Vul je e-mailadres in');
      return;
    }

    setLoading(true);
    setMessage('');

    const { error } = await signInWithEmail(email);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Controleer je e-mail voor de magic link!');
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
      <Card.Root className="w-full max-w-4xl shadow-xl glass-card transition-all duration-300 hover:shadow-neon-cyan/30">
        <Card.Body className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-pink flex items-center justify-center text-cyber-dark font-display font-bold">
              {user.email?.[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-gray-400">Ingelogd als</p>
              <p className="font-semibold text-cyber-cyan">{user.email}</p>
            </div>
          </div>
          <Button
            onClick={handleSignOut}
            className="px-4 py-2 bg-cyber-dark-secondary border border-cyber-pink/30 hover:border-cyber-pink text-cyber-pink rounded-lg font-display transition-all hover:shadow-neon-pink/50"
          >
            Uitloggen
          </Button>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root className="w-full max-w-4xl shadow-xl glass-card transition-all duration-300 hover:shadow-neon-cyan/30">
      <Card.Body className="flex flex-col gap-4">
        <div className="text-center">
          <Heading className="text-xl md:text-2xl font-display font-bold text-cyber-cyan">
            🔐 Inloggen
          </Heading>
          <p className="text-sm text-gray-400 mt-2">
            Log in om wedstrijdresultaten te kunnen registreren
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Field label="Emailadres">
            <Input
              type="email"
              placeholder="mail@qmg.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full bg-cyber-dark border-cyber-cyan/30 focus:border-cyber-cyan focus:ring-cyber-cyan/50"
            />
          </Field>

          <Button
            type="submit"
            disabled={loading}
            className="cyber-btn-primary w-full px-6 py-3 rounded-lg shadow-lg hover:shadow-neon-cyan transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Magic Link aan het versturen...' : '✨ Ontvang Magic Link'}
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
      </Card.Body>
    </Card.Root>
  );
};
