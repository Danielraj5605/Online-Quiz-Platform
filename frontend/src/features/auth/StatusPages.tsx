import { Link } from 'react-router-dom';
import { useAuth, homeFor } from '@/app/auth';
import { useDocumentTitle } from '@/lib/hooks';
import { Button } from '@/components/ui/button';

function Status({ code, title, body }: { code: string; title: string; body: string }) {
  const { user } = useAuth();
  return (
    <main id="main" className="paper-grain grid min-h-dvh place-items-center bg-bg p-6 text-center">
      <div className="max-w-md">
        <p className="num text-7xl font-semibold text-accent">{code}</p>
        <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-muted">{body}</p>
        <Button asChild className="mt-6"><Link to={user ? homeFor(user.role) : '/login'}>{user ? 'Back to your home' : 'Go to sign in'}</Link></Button>
      </div>
    </main>
  );
}

export function NotFound() {
  useDocumentTitle('Page not found');
  return <Status code="404" title="This page doesn’t exist" body="The link may be old, or the quiz may have been removed." />;
}
export function Forbidden() {
  useDocumentTitle('No access');
  return <Status code="403" title="You don’t have access to this" body="Your account role doesn’t allow this area. If that’s a mistake, ask an administrator." />;
}
