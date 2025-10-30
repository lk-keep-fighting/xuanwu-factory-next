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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    const message = status === 404 ? '项目不存在' : error.message
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const { data: duplicate, error: duplicateError } = await supabase
    .from('projects')
    .select('id')
    .eq('identifier', identifier)
    .neq('id', id)
    .maybeSingle()

  if (duplicateError) {
    if (duplicateError.code !== 'PGRST116') {
      return NextResponse.json({ error: duplicateError.message }, { status: 500 })
    }
  }

  if (duplicate) {
    return NextResponse.json({ error: '项目编号已被占用，请换一个' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('projects')
    .update({
      name,
      identifier,
      description
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const status =
      error.code === 'PGRST116' ? 404 : error.code === '23505' ? 409 : 500
    const message =
      status === 404
        ? '项目不存在'
        : status === 409
          ? '项目编号已被占用，请换一个'
          : error.message
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
