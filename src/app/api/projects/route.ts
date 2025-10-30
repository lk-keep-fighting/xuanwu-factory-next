import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

const normalizeIdentifier = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 63)

export async function GET() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const payload = await request.json()

  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const identifierInput = typeof payload.identifier === 'string' ? payload.identifier : ''
  const identifier = normalizeIdentifier(identifierInput)
  const description =
    typeof payload.description === 'string' && payload.description.trim() !== ''
      ? payload.description.trim()
      : null

  if (!name) {
    return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 })
  }

  if (!identifier || !IDENTIFIER_PATTERN.test(identifier)) {
    return NextResponse.json({ error: '项目编号格式不正确' }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from('projects')
    .select('id')
    .eq('identifier', identifier)
    .maybeSingle()

  if (existingError) {
    // PGRST116 表示没有匹配的数据，可忽略
    if (existingError.code !== 'PGRST116') {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }
  }

  if (existing) {
    return NextResponse.json({ error: '项目编号已被占用，请换一个' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      identifier,
      description
    })
    .select()
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    const message = error.code === '23505' ? '项目编号已被占用，请换一个' : error.message
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json(data)
}
