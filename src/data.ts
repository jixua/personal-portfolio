export interface ProjectFeature {
  title: string;
  detail: string;
  doc: string;
}

export interface Project {
  id: string;
  sortOrder?: number;
  num?: string;
  title: string;
  subtitle?: string;
  description: string;
  longDescription?: string;
  overview?: string;
  detail?: string;
  category?: "Backend" | "Full Stack";
  role?: string;
  period?: string;
  features?: ProjectFeature[] | string[];
  tags: string[];
  stack?: string[];
  thumbnailUrl?: string;
  imageUrl: string;
  link?: string;
  github?: string;
}

export interface BlogPost {
  id: string;
  sortOrder?: number;
  title: string;
  snippet: string;
  content?: string;
  date: string;
  readTime: string;
  category?: string;
  tag?: string;
  tagColor?: "indigo" | "teal" | "purple";
}

export interface DocNode {
  id: string;
  sortOrder?: number;
  title: string;
  isFolder?: boolean;
  children?: DocNode[];
  content?: string;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  date: string;
  description: string;
  achievements: string[];
  techStack: string[];
}

export const experiences: Experience[] = [
  {
    id: "exp-1",
    company: "字节跳动 (ByteDance)",
    role: "后端研发工程师 (实习)",
    date: "2025.07 - 2026.01",
    description: "参与核心业务线的后端开发与重构工作，负责高并发场景下的接口优化与微服务治理。深入理解了大规模分布式系统的架构设计与容灾策略。",
    achievements: [
      "主导了某核心链路的重构，利用 Redis 缓存与异步队列，将接口 P99 响应时间降低 40%。",
      "设计并实现了一套轻量级的配置中心方案，支持动态下发与秒级生效，减少了 80% 的硬编码修改需求。",
      "编写并维护了完善的单元测试与集成测试，覆盖率提升至 85% 以上。"
    ],
    techStack: ["Golang", "Redis", "Kafka", "Thrift", "MySQL"]
  },
  {
    id: "exp-2",
    company: "腾讯 (Tencent)",
    role: "全栈开发工程师 (实习)",
    date: "2024.11 - 2025.05",
    description: "加入企业级 SaaS 产品团队，负责管理后台系统从 0 到 1 的开发与维护，同时参与部分 Node.js BFF 层的搭建。在跨团队协作中积累了丰富的敏捷开发经验。",
    achievements: [
      "基于 React 和 TypeScript 构建了复杂的表单与数据可视化看板，提升了运营人员 30% 的工作效率。",
      "搭建了 Node.js (Koa) 的 BFF 接入层，实现了接口的聚合与裁剪，优化了首屏加载性能。",
      "推动并落地了团队内前端工程化建设，引入 ESLint、Prettier 与自动化 CI/CD 流水线。"
    ],
    techStack: ["React", "TypeScript", "Node.js", "Koa", "Docker"]
  },
  {
    id: "exp-3",
    company: "某初创科技公司",
    role: "后端开发工程师 (兼职)",
    date: "2024.03 - 2024.09",
    description: "独立负责一款面向大学生的社交平台后端开发。从数据库设计、接口定义到服务器部署，经历了完整的项目生命周期。",
    achievements: [
      "设计并实现了基于 JWT 的单点登录与 RBAC 权限管理模块。",
      "利用 WebSocket 实现了实时聊天功能与消息推送机制。",
      "完成了从云服务器采购、环境配置、Nginx 反向代理到 HTTPS 证书配置的全套部署流程。"
    ],
    techStack: ["Java", "Spring Boot", "MySQL", "WebSocket", "Nginx"]
  }
];

export const skills = {
  frontend: ["React", "TypeScript", "Tailwind CSS", "Next.js", "Framer Motion"],
  backend: ["Node.js", "Express", "PostgreSQL", "Redis", "GraphQL"],
  tools: ["Git", "Docker", "Figma", "Vercel", "AWS"],
};

export const projects: Project[] = [
  {
    id: "1",
    num: "01",
    title: "企业级 SaaS 平台后台系统",
    subtitle: "高可用多租户业务管理中台",
    description: "为中小企业提供的一站式业务管理平台后端。采用 Node.js 开发，设计合理的模块化架构与数据模型，确保业务数据的完整性与接口的高可用。",
    longDescription: "该系统的核心模块涵盖了用户权限系统 (RBAC)，租户管理、业务核心数据流转以及自动化工作流引擎。在此项目中我主导了微服务架构向单体模块化架构的过渡方案（为了适应当前的业务规模和研发成本），并通过 PostgreSQL 处理复杂的关联查询和数据报表。系统具备优秀的延展性和稳定性。",
    overview: "该系统的核心模块涵盖了用户权限系统 (RBAC)、租户管理、业务核心数据流转以及自动化工作流引擎。\n\n在此项目中我主导了微服务架构向单体模块化架构的过渡方案（为了适应当前的业务规模和研发成本），并通过 PostgreSQL 处理复杂的关联查询和数据报表。\n\n系统在高并发场景下表现稳定，P99 响应时间控制在 80ms 以内，月活用户突破 3 万，系统可用性维持在 99.95% 以上。",
    category: "Backend",
    role: "后端架构师",
    period: "2025.03 — 2025.08",
    features: [
      { title: "多租户数据隔离设计", detail: "基于 Schema 隔离策略，确保租户间数据严格隔离，防止越权访问", doc: "#" },
      { title: "基于 RBAC 的动态权限校验", detail: "支持角色、资源、操作三维权限矩阵，动态下发权限变更无需重启", doc: "#" },
      { title: "高频查询接口 Redis 缓存优化", detail: "热点数据本地缓存 + 分布式 Redis 二级缓存，接口吞吐量提升 5 倍", doc: "#" },
      { title: "完善的日志与错误追踪体系", detail: "集成 OpenTelemetry 实现全链路追踪，错误告警 P0 响应时间 < 3 分钟", doc: "#" },
    ],
    tags: ["Node.js", "Express", "PostgreSQL", "Redis"],
    stack: ["Node.js", "Express", "PostgreSQL", "Redis", "TypeScript", "Docker", "Nginx"],
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2000",
    link: "#",
    github: "#",
  },
  {
    id: "2",
    num: "02",
    title: "日志分析与告警平台",
    subtitle: "千万级日志实时分析与智能告警",
    description: "基于 Elastic 生态构建的内部日志收集与分析系统。通过优化查询与索引策略，提升了团队排查线上问题的效率。",
    longDescription: "面对公司日益增长的服务端日志，原有的查询体验变得极其缓慢。该项目着眼于对日志的生命周期管理，利用 Logstash 结合自定义 Parse 脚本进行日志的清洗、标准化后再入库 ElasticSearch。同时开发了基于 Node.js 的规则告警服务，能够通过 Webhook 即时推送到企业通讯软件。",
    overview: "面对公司日益增长的服务端日志，原有的查询体验变得极其缓慢。该项目着眼于对日志的生命周期管理，利用 Logstash 结合自定义 Parse 脚本进行日志的清洗、标准化后再入库 ElasticSearch。\n\n同时开发了基于 Node.js 的规则告警服务，能够通过 Webhook 即时推送到企业通讯软件。告警规则支持动态配置，运营人员可通过可视化界面配置告警阈值与推送渠道，无需工程师介入。\n\n日均处理日志量峰值达 2.3 亿条，P95 查询响应时间压缩至 120ms 以内。",
    category: "Full Stack",
    role: "全栈开发",
    period: "2024.11 — 2025.02",
    features: [
      { title: "千万级别日志数据秒级查询", detail: "结合 ES 索引分片与冷热数据分层，实现日均 2 亿+条日志的毫秒级检索", doc: "#" },
      { title: "告警规则动态配置与下发", detail: "可视化告警规则编辑器，支持阈值、频率、静默窗口等多维配置，秒级生效", doc: "#" },
      { title: "日志生命周期自动化滚动清理", detail: "基于 ILM 策略自动归档 + 清理，存储成本降低 40%，无需人工介入", doc: "#" },
      { title: "数据可视化仪表盘集成", detail: "集成 Kibana 并定制看板，关键业务指标一览无余，支持自定义时间范围钻取", doc: "#" },
    ],
    tags: ["Node.js", "ElasticSearch", "React", "Koa"],
    stack: ["Node.js", "Koa", "ElasticSearch", "Logstash", "Kibana", "React", "TypeScript"],
    imageUrl: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=2000",
    link: "#",
  },
  {
    id: "3",
    num: "03",
    title: "内部支付对账网关引擎",
    subtitle: "多渠道支付清算与幂等对账中台",
    description: "抽象出聚合支付的底层引擎，解决多渠道资金清算与对账难题。利用简单的状态机模式与事务机制，保证系统数据的一致性。",
    longDescription: "作为所有 C 端电商与虚拟商品支付的防线，支付网关的作用不仅仅是转发请求，更要解决掉单、重复支付及多渠道定时对账对平的痛点。该引擎引入了严谨的有限状态机 (FSM) ，利用 RabbitMQ 实现异步的支付状态轮询和对账单拉取，确保了订单与资金的一致性。",
    overview: "作为所有 C 端电商与虚拟商品支付的防线，支付网关的作用不仅仅是转发请求，更要解决掉单、重复支付及多渠道定时对账对平的痛点。\n\n该引擎引入了严谨的有限状态机 (FSM)，利用 RabbitMQ 实现异步的支付状态轮询和对账单拉取，确保了订单与资金的一致性。所有关键操作均通过 MySQL 事务 + 唯一索引保证幂等性，对账差异自动触发人工审核工作流。\n\n系统上线后，资金对账准确率达到 99.998%，支付成功率提升至 99.6%，月均处理交易额突破 2000 万。",
    category: "Backend",
    role: "后端研发",
    period: "2024.06 — 2024.10",
    features: [
      { title: "标准聚合支付 API 与 SDK 设计", detail: "统一封装微信、支付宝等多渠道，上层业务无感知切换，接入成本降低 70%", doc: "#" },
      { title: "分布式环境下的幂等性保证", detail: "基于 MySQL 唯一约束 + Redis 分布式锁双重防护，彻底杜绝重复扣款", doc: "#" },
      { title: "有限状态机引擎 (FSM)", detail: "订单状态流转严格遵循 FSM，每次跃迁均有事件溯源日志，异常可回溯", doc: "#" },
      { title: "长连接异步支付结果推送", detail: "基于 WebSocket + 消息队列实现毫秒级支付结果推送，告别轮询方案", doc: "#" },
    ],
    tags: ["Java", "Spring Boot", "MySQL", "RabbitMQ"],
    stack: ["Java", "Spring Boot", "MySQL", "RabbitMQ", "Redis", "WebSocket"],
    imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=2000",
    github: "#",
  },
];

export const blogPosts: BlogPost[] = [
  {
    id: "1",
    title: "记录一次 Node.js 内存泄漏排查全过程",
    snippet: "在日常开发中，即使是简单的业务代码如果不注意作用域与闭包，也很容易引起内存泄漏。本文记录了借助 Heap Snapshot 定位问题根源的经验...",
    date: "2026年5月12日",
    readTime: "8 分钟阅读",
  },
  {
    id: "2",
    title: "浅谈 PostgreSQL 中索引的设计与优化指北",
    snippet: "数据库索引并非加得越多越好，不合理的索引反而会拖累写入性能。基于最近重构的一批慢查询业务代码，聊聊我在索引优化上的一点心得...",
    date: "2026年4月28日",
    readTime: "6 分钟阅读",
  },
  {
    id: "3",
    title: "实现可靠的异步任务队列机制",
    snippet: "在使用 Redis 做简单的任务队列时，经常会遇到任务重试与死信处理的挑战。这篇笔记总结了我们从 Redis 迁移到专用消息中间件的踩坑历程...",
    date: "2026年3月15日",
    readTime: "12 分钟阅读",
  },
];

export const knowledgeDocs: DocNode[] = [
  {
    id: "kb-1",
    title: "Java相关技术栈",
    isFolder: true,
    children: [
      {
        id: "kb-1-1",
        title: "Java基础面试篇",
        isFolder: true,
        children: [
          { id: "kb-doc-1", title: "面向对象的三大特征", content: "## 面向对象的三大特征\n\n封装、继承、多态。\n\n### 封装\n把客观事物封装成抽象的类..." },
          { id: "kb-doc-2", title: "重载与重写的区别", content: "## 重载与重写的区别\n\n1. **重载 (Overload)**: 发生在同一个类中，方法名相同，参数列表不同...\n2. **重写 (Override)**: 发生在父子类中，方法名、参数列表必须相同..." }
        ]
      },
      {
        id: "kb-1-2",
        title: "Java多线程篇",
        isFolder: true,
        children: [
          { id: "kb-doc-3", title: "多线程基础", content: "## 多线程基础\n\n线程的生命周期包括：新建、就绪、运行、阻塞、死亡。" },
          {
            id: "kb-1-2-1",
            title: "重要知识点",
            isFolder: true,
            children: [
              { id: "kb-doc-4", title: "AQS", content: "## AQS (AbstractQueuedSynchronizer)\n\nAQS 是用来构建锁或者其他同步器组件的重量级基础框架及整个JUC体系的基石。" },
              { id: "kb-doc-5", title: "ThreadLocal", content: "## ThreadLocal\n\nThreadLocal 提供线程局部变量。这些变量与正常的变量不同，因为每一个线程在访问 ThreadLocal 实例的时候都有自己的、独立初始化的变量副本。" }
            ]
          }
        ]
      },
      {
        id: "kb-1-3",
        title: "Java虚拟机篇",
        isFolder: true,
        children: [
          {
            id: "kb-1-3-1",
            title: "重要知识点",
            isFolder: true,
            children: [
              { id: "kb-doc-6", title: "Java运行数据区", content: "## Java运行数据区\n\n包含程序计数器、虚拟机栈、本地方法栈、堆、方法区。" },
              { id: "kb-doc-7", title: "Java内存模型", content: "## Java内存模型解决什么问题\n\n**什么是Java内存模型？**\n\nJava内存模型规定了所有的变量都存储在主内存中。每条线程还有自己的工作内存，线程的工作内存中保存了被该线程使用的变量的主内存副本拷贝...\n\n**volatile关键字**\n\n保证可见性、禁止指令重排序...\n\n**原子性、可见性与有序性**\n\n1. 原子性：一个操作或者多个操作要么全部执行并且执行的过程不会被任何因素打断，要么就都不执行。\n2. 可见性：当多个线程访问同一个变量时，一个线程修改了这个变量的值，其他线程能够立即看得到修改的值。\n3. 有序性：即程序执行的顺序按照代码的先后顺序执行。" },
              { id: "kb-doc-8", title: "垃圾回收机制", content: "## 垃圾回收机制\n\n如何判断对象可以回收？\n1. 引用计数法\n2. 可达性分析" }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "kb-2",
    title: "数据库",
    isFolder: true,
    children: [
      { id: "kb-doc-9", title: "MySQL索引原理", content: "## MySQL索引原理\n\nInnoDB底层使用的是B+树..." },
      { id: "kb-doc-10", title: "事务的隔离级别", content: "## 事务的隔离级别\n\n1. 读未提交\n2. 读已提交\n3. 可重复读 (MySQL默认)\n4. 串行化" }
    ]
  },
  {
    id: "kb-3",
    title: "中间件",
    isFolder: true,
    children: [
      { id: "kb-doc-11", title: "Redis数据结构", content: "## Redis数据结构\n\nString, Hash, List, Set, ZSet..." }
    ]
  }
];
