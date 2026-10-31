import { z } from 'zod';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus, Mail, Lock } from 'lucide-react';
import { dashboardApi } from '../../api/dashboard';
import { userCreateSchema, UserCreateFormData } from '../../utils/validators';
import { User, UserRole } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { formatDate } from '../../utils/formatters';
import { showToast } from '../../components/ui/Toast';

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: dashboardApi.getUsers,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof userCreateSchema>, unknown, UserCreateFormData>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'staff',
      password: '',
      status: 'active',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: UserCreateFormData) => dashboardApi.createUser(data),
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast.success(`User ${newUser.name} created successfully`);
      setIsModalOpen(false);
      reset();
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to create user');
    },
  });

  const handleFormSubmit = async (data: UserCreateFormData) => {
    await createMutation.mutateAsync(data);
  };

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-semibold text-xs shrink-0">
            {u.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-slate-900 ">{u.name}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (u) => <span className="text-slate-600 text-xs">{u.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      align: 'center',
      render: (u) => {
        const roleColors: Record<UserRole, string> = {
          admin: 'bg-rose-50 text-rose-700 border-rose-200 ',
          staff: 'bg-indigo-50 text-indigo-700 border-indigo-200 ',
          customer: 'bg-emerald-50 text-emerald-700 border-emerald-200 ',
        };
        return (
          <span
            className={`px-2.5 py-1 text-xs font-semibold uppercase rounded-full border ${roleColors[u.role]}`}
          >
            {u.role}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Created On',
      sortable: true,
      render: (u) => <span className="text-xs text-slate-500">{formatDate(u.created_at)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      render: (u) => <StatusBadge status={u.status} size="sm" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 ">
            User & Team Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Access privileges, roles, and administrative operator accounts.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<UserPlus className="w-4 h-4" />}
          onClick={() => {
            reset();
            setIsModalOpen(true);
          }}
        >
          Add Staff User
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyTitle="No users found"
        emptyDescription="Create your team members to manage operations."
      />

      {/* Add Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add a staff member"
        description="Provision platform credentials for an operational team member."
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit(handleFormSubmit)}
              isLoading={createMutation.isPending}
            >
              Create User
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. John Doe"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="johndoe@brightloop.io"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Role Assignment"
              options={[{ value: 'staff', label: 'Staff (Operations)' }]}
              error={errors.role?.message}
              {...register('role')}
            />

            <Select
              label="Account Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              error={errors.status?.message}
              {...register('status')}
            />
          </div>

          <Input
            label="Initial Password"
            type="password"
            placeholder="••••••••"
            leftIcon={<Lock className="w-4 h-4" />}
            error={errors.password?.message}
            {...register('password')}
          />
        </form>
      </Modal>
    </div>
  );
};
