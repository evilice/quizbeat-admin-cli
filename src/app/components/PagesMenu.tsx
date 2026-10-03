import { List, ListItemButton, ListItemText } from '@mui/material';
import { Link } from 'react-router';

import type { SessionStore } from '../../modules/session/session-store.ts';

const menuItems = [
  { label: 'Сотрудники', to: '/admins', role: 'SUPER_ADMIN' },
  { label: 'Композиции', to: '/compositions' },
  { label: 'Теги', to: '/tags' },
];

const MenuItems: React.FC<{ session: SessionStore; pathname: string }> = ({
  session,
  pathname,
}) => {
  return menuItems.map((item) => {
    if (!item.role || item.role === session.role) {
      const selected =
        pathname === item.to || pathname.startsWith(`${item.to}/`);
      return (
        <ListItemButton
          key={item.to}
          component={Link}
          to={item.to}
          selected={selected}
          aria-current={selected ? 'page' : undefined}
        >
          <ListItemText primary={item.label} />
        </ListItemButton>
      );
    }
    return null;
  });
};

export const PagesMenu: React.FC<{
  session: SessionStore;
  pathname: string;
}> = ({ session, pathname }) => {
  return (
    <List>
      <MenuItems session={session} pathname={pathname} />
    </List>
  );
};
