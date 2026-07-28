'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Select } from '@guestportal/ui';
import { apiFetch } from '../lib/api';

type PropertyOption = { id: string; name: string; slug: string };
type TeamRole =
  | 'organization_owner'
  | 'organization_admin'
  | 'property_manager'
  | 'content_manager'
  | 'staff'
  | 'viewer';
type TeamMember = {
  userId: string;
  email: string;
  displayName: string;
  locale: string;
  role: TeamRole;
  status: 'active' | 'revoked' | 'invited';
  propertyIds: string[];
  lastActiveAt: string | null;
  createdAt: string;
};

const ROLE_OPTIONS: TeamRole[] = [
  'organization_owner',
  'organization_admin',
  'property_manager',
  'content_manager',
  'staff',
  'viewer',
];

export function AdminTeamPanel({
  organizationId,
  properties,
  invitations = false,
}: {
  organizationId: string;
  properties: PropertyOption[];
  invitations?: boolean;
}) {
  const t = useTranslations('team');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const propertyName = useMemo(
    () => new Map(properties.map((property) => [property.id, property.name])),
    [properties],
  );

  async function refresh() {
    setError(null);
    const result = await apiFetch<{ members: TeamMember[] }>(
      `/v1/organizations/${organizationId}/team/members`,
    );
    if (!result.ok) {
      setError(result.status === 403 ? t('permissionError') : t('loadError'));
      return;
    }
    setMembers(result.data.members);
  }

  useEffect(() => {
    if (organizationId) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function updateMember(
    member: TeamMember,
    payload: Partial<Pick<TeamMember, 'role' | 'propertyIds' | 'status'>> & { confirm?: true },
  ) {
    setBusyUserId(member.userId);
    setError(null);
    setSaved(null);
    const result = await apiFetch<{ member: TeamMember }>(
      `/v1/organizations/${organizationId}/team/members/${member.userId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
    setBusyUserId(null);
    if (!result.ok) {
      setError(result.status === 403 ? t('permissionError') : t('saveError'));
      return;
    }
    setSaved(t('saved'));
    await refresh();
  }

  function toggleProperty(member: TeamMember, propertyId: string) {
    const next = member.propertyIds.includes(propertyId)
      ? member.propertyIds.filter((id) => id !== propertyId)
      : [...member.propertyIds, propertyId];
    void updateMember(member, { propertyIds: next });
  }

  if (invitations) {
    return (
      <main className="gp-state" data-testid="team-invitations-panel">
        <h2 className="gp-state__title">{t('invitationsTitle')}</h2>
        <p className="gp-state__body">{t('invitationsBody')}</p>
        <p data-testid="team-invitations-empty">{t('invitationsEmpty')}</p>
      </main>
    );
  }

  return (
    <main className="gp-state" data-testid="team-members-panel">
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>
      <Button data-testid="team-refresh" variant="secondary" onClick={() => void refresh()}>
        {t('refresh')}
      </Button>
      {error ? (
        <p data-testid="team-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p data-testid="team-saved">{saved}</p> : null}
      {members.length === 0 && !error ? <p data-testid="team-empty">{t('empty')}</p> : null}
      <div className="admin-ops__tableWrap" style={{ marginTop: '1rem' }}>
        <table className="admin-ops__table">
          <thead>
            <tr>
              <th>{t('member')}</th>
              <th>{t('role')}</th>
              <th>{t('properties')}</th>
              <th>{t('status')}</th>
              <th>{t('lastActive')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId} data-testid="team-member-row">
                <td>
                  <strong>{member.displayName}</strong>
                  <div>{member.email}</div>
                </td>
                <td>
                  <Select
                    label={t('role')}
                    data-testid={`team-role-${member.email}`}
                    value={member.role}
                    onChange={(event) =>
                      void updateMember(member, { role: event.target.value as TeamRole })
                    }
                    disabled={busyUserId === member.userId || member.status !== 'active'}
                    options={ROLE_OPTIONS.map((role) => ({ value: role, label: t(`roles.${role}`) }))}
                  />
                </td>
                <td>
                  <div className="gp-stack" style={{ gap: 6, minWidth: 220 }}>
                    {properties.map((property) => (
                      <label key={property.id}>
                        <input
                          data-testid={`team-property-${member.email}-${property.slug}`}
                          type="checkbox"
                          checked={member.propertyIds.includes(property.id)}
                          disabled={busyUserId === member.userId || member.status !== 'active'}
                          onChange={() => toggleProperty(member, property.id)}
                        />{' '}
                        {propertyName.get(property.id)}
                      </label>
                    ))}
                  </div>
                </td>
                <td data-testid={`team-status-${member.email}`}>{member.status}</td>
                <td>{member.lastActiveAt ? new Date(member.lastActiveAt).toLocaleString() : '-'}</td>
                <td>
                  {member.status === 'active' ? (
                    <Button
                      data-testid={`team-revoke-${member.email}`}
                      variant="danger"
                      loading={busyUserId === member.userId}
                      onClick={() => {
                        if (window.confirm(t('revokeConfirm', { member: member.displayName }))) {
                          void updateMember(member, { status: 'revoked', confirm: true });
                        }
                      }}
                    >
                      {t('revoke')}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
