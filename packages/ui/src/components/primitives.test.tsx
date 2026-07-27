import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import '../primitives.css';
import { Button } from './Button.js';
import { Dialog } from './Dialog.js';
import { Drawer } from './Drawer.js';
import { EmptyState, ErrorState, Loading, SkeletonBlock } from './Feedback.js';
import { Input } from './Input.js';
import { Menu } from './Menu.js';
import { Select } from './Select.js';
import { Table } from './Table.js';
import { Tabs } from './Tabs.js';

describe('accessible component primitives', () => {
  it('renders button interactive states and keeps focus visible class path', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Lưu</Button>
        <Button variant="secondary" disabled>
          Disabled
        </Button>
        <Button loading>Saving</Button>
      </>,
    );

    await user.tab();
    expect(screen.getByRole('button', { name: 'Lưu' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Saving' })).toHaveAttribute('aria-busy', 'true');
  });

  it('associates input errors for assistive tech', async () => {
    const user = userEvent.setup();
    render(<Input label="Email" error="Email không hợp lệ" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Email không hợp lệ');
    await user.type(input, 'a@b.co');
    expect(input).toHaveValue('a@b.co');
  });

  it('supports select keyboard activation without business logic', async () => {
    const user = userEvent.setup();
    render(
      <Select
        label="Property"
        defaultValue="hotel"
        options={[
          { value: 'hotel', label: 'Aurora City Hotel' },
          { value: 'cruise', label: 'Aurora Bay Cruise' },
        ]}
      />,
    );
    const select = screen.getByLabelText('Property');
    await user.selectOptions(select, 'cruise');
    expect(select).toHaveValue('cruise');
  });

  it('opens dialog and closes via cancel while keeping focusable actions', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open title="Xác nhận xóa" onClose={onClose} danger>
        Hành động này không hoàn tác.
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
  });

  it('moves focus into drawer when opened', () => {
    render(
      <Drawer open title="Quick edit" onClose={() => undefined}>
        Fieldless drawer body
      </Drawer>,
    );
    expect(screen.getByTestId('drawer-close')).toHaveFocus();
  });

  it('navigates menu items with arrow keys', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu
        label="Actions"
        items={[
          { id: 'edit', label: 'Edit', onSelect },
          { id: 'archive', label: 'Archive', onSelect },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    items[0]?.focus();
    await user.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalled();
  });

  it('changes tabs with arrow keys and updates tabpanel', async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        items={[
          { id: 'overview', label: 'Overview', panel: 'Overview panel' },
          { id: 'settings', label: 'Settings', panel: 'Settings panel' },
        ]}
      />,
    );
    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Settings panel')).toBeInTheDocument();
  });

  it('renders table headers and empty pattern', () => {
    render(
      <Table
        caption="Properties"
        columns={[
          { id: 'name', header: 'Name', cell: (row: { name: string }) => row.name },
        ]}
        rows={[{ name: 'Aurora City Hotel' }]}
        getRowId={(row) => row.name}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('Aurora City Hotel')).toBeInTheDocument();

    render(
      <Table
        columns={[{ id: 'name', header: 'Name', cell: () => null }]}
        rows={[]}
        getRowId={() => 'x'}
        empty={<EmptyState title="Chưa có dữ liệu" description="Thêm property để bắt đầu." />}
      />,
    );
    expect(screen.getByTestId('empty-state')).toHaveTextContent('Chưa có dữ liệu');
  });

  it('exposes loading/error/skeleton patterns', () => {
    render(
      <>
        <Loading label="Đang tải" />
        <ErrorState title="Không tải được" description="Thử lại sau." onRetry={() => undefined} />
        <SkeletonBlock lines={2} />
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
    expect(screen.getByTestId('error-state')).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('skeleton-block')).toHaveAttribute('aria-busy', 'true');
  });

  it('has no serious axe violations for core primitive composition', async () => {
    const { container } = render(
      <main>
        <h1>Primitives</h1>
        <Button>Primary</Button>
        <Input label="Name" hint="Visible hint" />
        <Select
          label="Locale"
          options={[
            { value: 'vi', label: 'Tiếng Việt' },
            { value: 'en', label: 'English' },
          ]}
          defaultValue="vi"
        />
        <Tabs
          items={[
            { id: 'a', label: 'Một', panel: 'Nội dung một' },
            { id: 'b', label: 'Hai', panel: 'Nội dung hai' },
          ]}
        />
        <Table
          caption="Demo"
          columns={[{ id: 'c', header: 'Col', cell: (row: { v: string }) => row.v }]}
          rows={[{ v: 'Row' }]}
          getRowId={(row) => row.v}
        />
        <EmptyState title="Empty" />
      </main>,
    );

    const results = await axe(container, {
      rules: {
        // jsdom lacks canvas; contrast is validated via token AA design + Storybook a11y.
        'color-contrast': { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);
    const evidenceDir = join(process.cwd(), '../../evidence/phase-02/02.2');
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, 'axe-report.json'), `${JSON.stringify(results, null, 2)}\n`);
  });
});
