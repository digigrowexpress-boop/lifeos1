import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function Card({ title, sub, icon: Icon, action, link, children, className = '', glow = false, ...rest }) {
  return (
    <section className={`card ${glow ? 'glow' : ''} ${className}`} {...rest}>
      {(title || action || link) && (
        <header className="card-header">
          <div className="grow">
            {title && (
              <h2 className="card-title">
                {Icon && <Icon size={16} aria-hidden />}
                {title}
              </h2>
            )}
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          {action}
          {link && (
            <Link className="card-link" to={link.to}>
              {link.label} <ArrowRight size={13} aria-hidden />
            </Link>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div className="grow">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, unit, foot, icon: Icon, hero = false, className = '' }) {
  return (
    <div className={`stat ${hero ? 'hero' : ''} ${className}`}>
      <div className="stat-label">
        {Icon && <Icon size={13} aria-hidden />}
        {label}
      </div>
      <div className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

export function StatTile(props) {
  return (
    <div className="stat-tile">
      <Stat {...props} />
    </div>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty-icon">
          <Icon size={22} aria-hidden />
        </div>
      )}
      {title && <h3>{title}</h3>}
      {children && <p>{children}</p>}
      {action && <div className="mt-sm">{action}</div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
        >
          {t.icon && <t.icon size={14} aria-hidden />}
          {t.label}
          {t.count != null && <span className="badge">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Callout({ tone = 'info', icon: Icon, children }) {
  return (
    <div className={`callout tone-${tone}`}>
      {Icon && <Icon size={16} aria-hidden />}
      <div className="grow">{children}</div>
    </div>
  );
}
