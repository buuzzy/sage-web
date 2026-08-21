export default {
  cancel: '取消',
  delete: '删除',
  confirm: '确认',
  more: '更多...',
  loading: '加载中...',

  // 滚动
  scrollToBottom: '滚动到底部',

  // 任务操作
  favorite: '收藏',
  unfavorite: '取消收藏',
  rename: '重命名',
  taskTitle: '标题',
  deleteTaskConfirm: '确定要删除这个任务吗？',
  deleteTaskDescription: '此操作无法撤销，任务中的所有消息将被永久删除。',

  // API 错误提示
  errors: {
    connectionFailedFinal: '无法连接到服务，请检查网络或稍后再试',
    corsError: '请求被阻止，请检查服务配置',
    timeout: '请求超时，请稍后再试',
    serverNotRunning: '服务未启动，请先启动应用',
    requestFailed: '请求失败：{message}',
    retrying: '正在重试 ({attempt}/{max})...',
    internalError: '服务内部错误，详情请查看日志文件：{logPath}',
    customApiError:
      '自定义 API ({baseUrl}) 可能与 Claude Code SDK 不兼容。请检查 API 配置或尝试其他服务商。日志文件：{logPath}',
    modelNotConfigured:
      '尚未配置 AI 模型。请先配置自定义模型（API 地址、密钥、模型名称）后再开始对话。',
    claudeCodeNotFound:
      'Claude Code 未安装或不可用。请在设置中配置自定义 AI 模型，或安装 Claude Code（npm install -g @anthropic-ai/claude-code）',
    configureModel: '配置模型',
    apiKeyError:
      'AI 模型接口请求失败，请检查模型配置是否正确（API 地址、密钥、模型名称等）',
    configureApiKey: '前往配置',
  },

  // Question input
  questionInput: {
    needsInput: '需要您的输入',
    submit: '提交回答',
    other: '其他',
    customInput: '自定义输入',
    placeholder: '请输入您的回答...',
  },
};
