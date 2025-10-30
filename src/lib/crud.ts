import { request } from "@/lib/http"
type QueryCondition = {
    column: string
    operator: string
    value: any
}
export const crudSvc = {
    add: async (dataModel: string, data: any) => {
        const res = await request.post('/api/data-model/crud/' + dataModel + '/add', data)
        return res.data
    },
    batchAdd: async (dataModel: string, data: any) => {
        const res = await request.post('/api/data-model/crud/' + dataModel + '/batch-add', data)
        return res.data
    },
    edit: async (dataModel: string, data: any) => {
        const res = await request.put('/api/data-model/crud/' + dataModel + '/edit', data)
        return res.data
    },
    delete: async (dataModel: string, id: any) => {
        const res = await request.delete('/api/data-model/crud/' + dataModel + '/delete/' + id)
        return res.data
    },
    get: async (dataModel: string, id: any) => {
        const res = await request.get('/api/data-model/crud/' + dataModel + '/get/' + id)
        return res.data
    },
    query: async (dataModel: string, data: any) => {
        const res = await request.post('/api/data-model/crud/' + dataModel + '/query', data)
        return res.data
    },
    queryPage: async (dataModel: string) => {
        const res = await request.post('/api/data-model/crud/' + dataModel + '/query-page', {})
        return res.data
    },
    queryPageByConditions: async (dataModel: string, page: number = 1, pageSize: number = 10, conditions: QueryCondition[] = []) => {
        const res = await request.post('/api/data-model/crud/' + dataModel + '/query-page', {
            page,
            pageSize,
            conditions
        })
        return res.data
    },
}