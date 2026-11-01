import type { CapabilityStatus, DeviceStatus, TaskStatus } from '../data/nexus'

const TASK: Record<TaskStatus, string> = {
  QUEUED: '排队中',
  PREPARING: '准备中',
  RUNNING: '执行中',
  WAITING_APPROVAL: '等待审批',
  PAUSED: '已暂停',
  TESTING: '测试中',
  REVIEWING: '审查中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消',
}

const DEVICE: Record<DeviceStatus, string> = {
  ENROLLING: '注册中',
  ONLINE: '在线',
  IDLE: '空闲',
  BUSY: '忙碌',
  BACKGROUND: '后台',
  OFFLINE: '离线',
  NEEDS_APPROVAL: '待审批',
  ERROR: '异常',
  REVOKED: '已撤销',
}

const CAP: Record<CapabilityStatus, string> = {
  Planned: '规划中',
  Implementing: '开发中',
  Implemented: '已实现',
  Verified: '已验证',
  Blocked: '阻塞',
  'Not Supported': '不支持',
}

export const taskStatusLabel = (s: TaskStatus) => TASK[s]
export const deviceStatusLabel = (s: DeviceStatus) => DEVICE[s]
export const capabilityLabel = (s: CapabilityStatus) => CAP[s]
export const modelLabel = (m: { name: string; label?: string } | undefined | null) => (m ? m.label ?? m.name : '—')
