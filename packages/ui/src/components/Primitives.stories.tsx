import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Drawer } from './Drawer';
import { EmptyState, ErrorState, Loading, SkeletonBlock } from './Feedback';
import { FilterBar } from './FilterBar';
import { Input } from './Input';
import { Menu } from './Menu';
import { PageHeader } from './PageHeader';
import { Select } from './Select';
import { StatusBadge } from './StatusBadge';
import { Table } from './Table';
import { Tabs } from './Tabs';

function Gallery() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div
      data-testid="primitives-gallery"
      style={{ display: 'grid', gap: 24, maxWidth: 960 }}
      data-theme="light"
    >
      <section>
        <h1>GuestPortal primitives</h1>
        <p>Đăng nhập quản trị - Coastal hotel express check-in workflow</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <PageHeader
        eyebrow="Operations"
        title="Requests"
        description="Urgent guest work, filtered by status and service window."
        actions={<Button variant="secondary">Export</Button>}
        meta={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge tone="warning">submitted</StatusBadge>
            <StatusBadge tone="info">in progress</StatusBadge>
            <StatusBadge tone="success">completed</StatusBadge>
          </div>
        }
      />

      <FilterBar activeSummary="3 active filters">
        <Select
          label="Status"
          defaultValue="submitted"
          options={[
            { value: 'all', label: 'All' },
            { value: 'submitted', label: 'Submitted' },
          ]}
        />
      </FilterBar>

      <section style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
        <Input label="Email" hint="Dùng email công việc" defaultValue="owner@aurora.test" />
        <Input label="Password" type="password" error="Mật khẩu quá ngắn" />
        <Select
          label="Property"
          defaultValue="hotel"
          options={[
            { value: 'hotel', label: 'Aurora City Hotel' },
            { value: 'cruise', label: 'Aurora Bay Cruise' },
          ]}
        />
      </section>

      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
          Open drawer
        </Button>
        <Menu
          label="Actions"
          items={[
            { id: 'edit', label: 'Edit' },
            { id: 'archive', label: 'Archive' },
            { id: 'disabled', label: 'Disabled', disabled: true },
          ]}
        />
      </section>

      <Tabs
        items={[
          {
            id: 'overview',
            label: 'Tổng quan',
            panel: 'Nội dung tổng quan dài để kiểm tra wrap tiếng Việt không cắt CTA.',
          },
          { id: 'team', label: 'Team settings', panel: 'English long-label panel content.' },
        ]}
      />

      <Table
        caption="Properties"
        columns={[
          { id: 'name', header: 'Name', cell: (row: { name: string }) => row.name },
          { id: 'type', header: 'Type', cell: (row: { type: string }) => row.type },
        ]}
        rows={[
          { name: 'Aurora City Hotel', type: 'hotel' },
          { name: 'Nomad Loft District 1', type: 'airbnb' },
        ]}
        getRowId={(row) => row.name}
      />

      <div style={{ display: 'grid', gap: 12 }}>
        <Loading label="Đang tải danh sách" />
        <SkeletonBlock lines={3} />
        <EmptyState
          title="Chưa có request"
          description="Khi khách gửi yêu cầu, danh sách sẽ hiện tại đây."
          actionLabel="Refresh"
          onAction={() => undefined}
        />
        <ErrorState
          title="Không tải được dữ liệu"
          description="Vui lòng thử lại. Please try again."
          onRetry={() => undefined}
        />
      </div>

      <Dialog
        open={dialogOpen}
        title="Xác nhận xóa"
        onClose={() => setDialogOpen(false)}
        danger
        confirmLabel="Delete"
      >
        Hành động này không hoàn tác.
      </Dialog>
      <Drawer open={drawerOpen} title="Quick edit" onClose={() => setDrawerOpen(false)}>
        Drawer dùng cho chỉnh sửa ngắn dưới 8 trường.
      </Drawer>
    </div>
  );
}

const meta = {
  title: 'Primitives/Gallery',
  component: Gallery,
} satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Buttons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button disabled>Disabled</Button>
      <Button loading>Loading</Button>
    </div>
  ),
};

export const FormControls: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
      <Input label="Name" />
      <Input label="Code" error="Required" />
      <Select
        label="Status"
        options={[
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
        ]}
        defaultValue="open"
      />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      <Loading />
      <EmptyState title="Empty" description="Nothing here yet." />
      <ErrorState title="Error" description="Something failed." onRetry={() => undefined} />
      <SkeletonBlock />
    </div>
  ),
};
