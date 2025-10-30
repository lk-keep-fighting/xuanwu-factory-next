import { supabase } from './supabase'

/**
 * 基于 Supabase 的通用 CRUD 工具函数
 */
export const supabaseCrud = {
  /**
   * 创建记录
   */
  async create<T>(table: string, data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single()

    if (error) throw error
    return result as T
  },

  /**
   * 批量创建记录
   */
  async createMany<T>(table: string, data: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<T[]> {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()

    if (error) throw error
    return result as T[]
  },

  /**
   * 根据 ID 获取单条记录
   */
  async getById<T>(table: string, id: string): Promise<T | null> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as T
  },

  /**
   * 获取所有记录
   */
  async getAll<T>(table: string): Promise<T[]> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as T[]
  },

  /**
   * 根据条件查询
   */
  async query<T>(
    table: string,
    filters?: Record<string, any>,
    orderBy?: { column: string; ascending?: boolean }
  ): Promise<T[]> {
    let query = supabase.from(table).select('*')

    // 应用过滤条件
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value)
      })
    }

    // 应用排序
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false })
    }

    const { data, error } = await query

    if (error) throw error
    return data as T[]
  },

  /**
   * 分页查询
   */
  async queryPage<T>(
    table: string,
    page: number = 1,
    pageSize: number = 10,
    filters?: Record<string, any>,
    orderBy?: { column: string; ascending?: boolean }
  ): Promise<{ data: T[]; total: number; page: number; pageSize: number }> {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase.from(table).select('*', { count: 'exact' })

    // 应用过滤条件
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value)
      })
    }

    // 应用排序
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false })
    }

    // 应用分页
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    return {
      data: data as T[],
      total: count || 0,
      page,
      pageSize
    }
  },

  /**
   * 更新记录
   */
  async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return result as T
  },

  /**
   * 删除记录
   */
  async delete(table: string, id: string): Promise<void> {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  /**
   * 批量删除
   */
  async deleteMany(table: string, ids: string[]): Promise<void> {
    const { error } = await supabase
      .from(table)
      .delete()
      .in('id', ids)

    if (error) throw error
  }
}
