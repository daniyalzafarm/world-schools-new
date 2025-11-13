import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create system permissions
  console.log('Creating permissions...');
  const permissions = [
    { id: 'users.create', name: 'Create users' },
    { id: 'users.read', name: 'Read users' },
    { id: 'users.update', name: 'Update users' },
    { id: 'users.delete', name: 'Delete users' },
    { id: 'roles.create', name: 'Create roles' },
    { id: 'roles.read', name: 'Read roles' },
    { id: 'roles.update', name: 'Update roles' },
    { id: 'roles.delete', name: 'Delete roles' },
    { id: 'providers.create', name: 'Create providers' },
    { id: 'providers.read', name: 'Read providers' },
    { id: 'providers.update', name: 'Update providers' },
    { id: 'providers.delete', name: 'Delete providers' },
    { id: 'parents.create', name: 'Create parents' },
    { id: 'parents.read', name: 'Read parents' },
    { id: 'parents.update', name: 'Update parents' },
    { id: 'parents.delete', name: 'Delete parents' },
    { id: 'children.create', name: 'Create children' },
    { id: 'children.read', name: 'Read children' },
    { id: 'children.update', name: 'Update children' },
    { id: 'children.delete', name: 'Delete children' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { id: permission.id },
      update: {},
      create: permission,
    });
  }

  console.log(`✅ Created ${permissions.length} permissions`);

  // Create system roles
  console.log('Creating system roles...');

  // Super Admin Role (has all permissions)
  let superAdminRole = await prisma.role.findFirst({
    where: { name: 'Super Admin', isSystemRole: true, providerId: null },
  });

  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: {
        name: 'Super Admin',
        isSystemRole: true,
        providerId: null,
      },
    });
  }

  // Assign all permissions to Super Admin
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Provider Admin Role (for school owners)
  let providerAdminRole = await prisma.role.findFirst({
    where: { name: 'Provider Admin', isSystemRole: true, providerId: null },
  });

  if (!providerAdminRole) {
    providerAdminRole = await prisma.role.create({
      data: {
        name: 'Provider Admin',
        isSystemRole: true,
        providerId: null,
      },
    });
  }

  // Assign provider-related permissions to Provider Admin
  const providerAdminPermissions = permissions.filter(
    (p) =>
      p.id.startsWith('providers.') ||
      p.id.startsWith('parents.') ||
      p.id.startsWith('children.') ||
      p.id === 'users.read' ||
      p.id === 'roles.read',
  );

  for (const permission of providerAdminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: providerAdminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: providerAdminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Parent Role (for parents)
  let parentRole = await prisma.role.findFirst({
    where: { name: 'Parent', isSystemRole: true, providerId: null },
  });

  if (!parentRole) {
    parentRole = await prisma.role.create({
      data: {
        name: 'Parent',
        isSystemRole: true,
        providerId: null,
      },
    });
  }

  // Assign parent-related permissions
  const parentPermissions = permissions.filter(
    (p) => p.id === 'children.read' || p.id === 'parents.read',
  );

  for (const permission of parentPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: parentRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: parentRole.id,
        permissionId: permission.id,
      },
    });
  }

  console.log('✅ Created system roles: Super Admin, Provider Admin, Parent');

  // Create a super admin user
  console.log('Creating super admin user...');
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@worldschools.com' },
    update: {},
    create: {
      email: 'admin@worldschools.com',
      passwordHash: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
    },
  });

  // Assign Super Admin role to admin user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });

  console.log('✅ Created super admin user: admin@worldschools.com / admin123');

  console.log('');
  console.log('🎉 Seeding completed successfully!');
  console.log('');
  console.log('📝 Login credentials:');
  console.log('   Email: admin@worldschools.com');
  console.log('   Password: admin123');
  console.log('');
  console.log('⚠️  Remember to change the admin password in production!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
