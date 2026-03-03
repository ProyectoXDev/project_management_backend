import db from '@config/database';
import { IUserRepository, User, CreateUserDTO, UserFilters } from '@domain/user/user.entity';

export class UserRepository implements IUserRepository {
    async findByEmail(email: string): Promise<User | null> {
        const user = await db('users').where({ email }).first();
        return user || null;
    }

    async findById(id: string): Promise<User | null> {
        const user = await db('users').where({ id }).first();
        return user || null;
    }

    async create(data: CreateUserDTO): Promise<User> {
        const [user] = await db('users').insert(data).returning('*');
        return user;
    }

    async update(id: string, data: Partial<User>): Promise<User> {
        const [user] = await db('users')
            .where({ id })
            .update({ ...data, updated_at: new Date() })
            .returning('*');
        return user;
    }

    async delete(id: string): Promise<void> {
        await db('users').where({ id }).delete();
    }

    async findAll(filters?: UserFilters): Promise<User[]> {
        let query = db('users').select(
            'id', 'name', 'email', 'role', 'status', 'created_at', 'updated_at'
        );
        if (filters?.role) query = query.where('role', filters.role);
        if (filters?.status) query = query.where('status', filters.status);
        if (filters?.projectId) {
            query = query.join('project_members', 'users.id', 'project_members.user_id')
                .where('project_members.project_id', filters.projectId);
        }
        return query;
    }
}
