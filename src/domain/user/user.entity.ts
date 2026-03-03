export interface IUserRepository {
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    create(data: CreateUserDTO): Promise<User>;
    update(id: string, data: Partial<User>): Promise<User>;
    delete(id: string): Promise<void>;
    findAll(filters?: UserFilters): Promise<User[]>;
}

export interface User {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: 'admin' | 'pm' | 'dev' | 'qa';
    status: 'active' | 'inactive';
    created_at: Date;
    updated_at: Date;
}

export interface CreateUserDTO {
    name: string;
    email: string;
    password_hash: string;
    role: 'admin' | 'pm' | 'dev' | 'qa';
}

export interface UserFilters {
    role?: string;
    status?: string;
    projectId?: string;
}
