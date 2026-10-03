import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Card, Empty } from '../components/ui/Card.jsx';

/** Shown when a regular user opens an admin URL directly. The admin API refuses them too. */
export default function AdminOnly() {
  return (
    <Card>
      <Empty icon={ShieldAlert} title="Admin access only" action={<Link className="btn btn-primary" to="/">Back to your dashboard</Link>}>
        This area is reserved for the LifeOS administrator. Your account doesn’t have access to it.
      </Empty>
    </Card>
  );
}
