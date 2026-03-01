"use client"

import { CustomerOrder } from './inventory-store'
import { database } from './firebase'
import { ref, get } from 'firebase/database'

// Base64-encoded Yellow Roast Co. logo (public/yrc-logo.png)
// Split into 8 segments to avoid TypeScript parser limits
const yrcLogoSeg1 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCwwLCQ4MCwwQDw4RFSMXFRMTFSsfIRojMy02NTItMTA4P1FFODxNPTAxRmBHTVRWW1xbN0RjamNYalFZW1f/2wBDAQ8QEBUSFSkXFylXOjE6V1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1f/wAARCALUAzwDAREAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0egAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgBaAEoAWgAoAKACgAoAKACgAoASgAoAWgAoAKACgAoAKAEoAWgAoASgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAPN/i5/wAwj/tt/wCyV87nv/Lv5/ofO57/AMu/n+h6RX0R9EFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAC0AFABQAUAFABQAUAFABQAlABQAtABQAUAJQAtABQAUAJQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAeb/Fz/AJhH/bb/ANkr53Pf+Xfz/Q+dz3/l38/0PSK+iPogoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAFoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAEoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAPN/i5/zCP+23/slfO57/y7+f6Hzue/8u/n+h6RX0R9EFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAC0AFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAJQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAF'
const yrcLogoSeg2 = 'ABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQB5v8AFz/mEf8Abb/2Svnc9/5d/P8AQ+dz3/l38/0PSK+iPogoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAFoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoASgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAPN/i5/zCP8Att/7JXzue/8ALv5/ofO57/y7+f6HpFfRH0QUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAC0AFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFACUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAHm/xc/5hH/bb/2Svnc9/wCXfz/Q+dz3/l38/wBD0ivoj6IKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAFoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgBKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgDzf4uf8wj/tt/7JXzue/wDLv5/ofO57/wAu/n+h6RX0R9EFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAC0AFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAJQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQB5v8XP+YR/22/8AZK+dz3/l38/0Pnc9/wCXfz/Q9Ir6I+iCgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAWgAoAKACgBKAFoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgBKAFoASgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAPN/i5/wAwj/tt/wCyV87nv/Lv5/ofO57/AMu/n+h6RX0R9EFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAtABQAUAJQAtABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAJQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAHm/xc/5hH/bb/2Svnc9/wCXfz/Q+dz3/l38/wBD0ivoj6IKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAFoASgAoAKAFoAKACgA'
const yrcLogoSeg3 = 'oAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAEoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAPN/i5/zCP+23/slfO57/y7+f6Hzue/8u/n+h6RX0R9EFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUALQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFACEgDJoAoWmr2t3O8MbfOhwQalSTNp0JwipMuTlhC5T72OKbMo2vqcQPEmoWs7JKQ204INc3tGmex9UpTjdHRaVr0F+ArHZJ6Gto1FI4K+FlS13RX1vW59Ou0VEBjIz9amdRxZph8PGrC73NLS9Th1GHdGcOPvL6VpGSkc1ajKk7Mv1RkFABQAUAFABQAUAJQAUALQAUAJQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAHm/xc/5hH/bb/2Svnc9/wCXfz/Q+dz3/l38/wBD0ivoj6IKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgBaAEoAWgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAp6rMYdPmcdQpqZuyNKMeaaR5vFcywT+dGxDg5zXGpNO578oKUbM6zSvFMcoWO7+Rum7tW8Kvc82tgXHWBjeI1gOomS3cOrjJxWVW19DrwnN7O0jORijBlJBHIIrNOx0NXRf1LVTf28COnzxjBbPWrlPmRhRoeyk2tmQ6VfyWF4kqn5c4YeoohLlZdaiqsbHTXniqC3ljWOPzFIySD0rd1UebTwMpJt6G1Y3sV7AssLAg/pWqaaOSpTdOVmWaZAUAFABQAUAFABQAlABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQB5v8XP8AmEf9tv8A2Svnc9/5d/P9D53Pf+Xfz/Q9Ir6I+iCgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgBaACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgDP1xC+lzqOu01E9jbDu1RHnGOTmuI+gACgB1ABmgBM0AFADTQBu+E9RNvefZ2P7uX9DW1KVnY4sbRUocy3R3ddR4wUAFABQAUAFABQAUAJQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQB5v8XP+YR/22/8AZK+dz3/l38/0Pnc9/wCXfz/Q9Ir6I+iCgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgBaACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgBsiCRGRhwRg0bgnbU851qxewvXQg7Ccqa4px5We/hqqqQuUM1BuGaBhmgA5PQUCDB7gilcLhTAmsiwu4in3twxiqjuTU1i7np0WfLXPXFdqPnHuPpiCgAoAKACgAoAKACgAFACUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAHm/wAW/wDmEf8Abb/2Svnc9/5d/P8AQ+dz3/l38/0PSK+iPogoAK'
const yrcLogoSeg4 = 'ACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgBaACgBKAFoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoApanpkGpQ+XMvPZu4qZRUtzWlWlSd4nH6j4auLQM6MrxDnJOK55UWj1KWNjPR7mGTzjvWR3Grp+jtMBJPlU7D1rmq11HRHPVrqOiNqKxt4lAWJfxrkdWTOR1JPqOezgkGGiX8qSnJCU5LqZd7onBe3P/ATXTTr9GdFPEdJGfak2V2kk0RO09COtdkJLdG03zxaTO60/WrO9UBZAjn+FuK641FI8arhp0+mhpVoc4UAFABQAUAFABQAUAFABQAlABQAtABQAlABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAeb/Fz/AJhH/bb/ANkr53Pf+Xfz/Q+dz3/l38/0PSK+iPogoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgBaACgAoAKACgAoAKAIZru3gBMsyL9TSbSKjCUtkUZNf01Dg3C/hUe0ibLC1X0EXxDprdLgUe0iN4SquhZi1Oyl+5cIfxpqcWZyoVI7otqwYZUgj2qjJqwtMAoAKACgAoAKACgBGYKCSeBQBwnibWWupzbwtiJDg47muapUvoj2cJh/ZrmluM0XSwQLidf8AdBrzq9boi61b7KNzGOlce+5yC0AFAhwpoCrdXFmqkTlG9u9bQjN7GkYyexgXklv5gNoHU57V201NbnZTUvtG74d1LUPMWGWB5YW/jI+7XZTlLqcOLo07c0XZnWVseaFABQAUAFABQAUAFABQAlABQAtACUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAeb/ABb/AOYR/wBtv/ZK+dz3/l38/wBD53Pf+Xfz/Q9Ir6I+iCgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAFoAKACgAoAKACgAoAKAMvUtds9PBDuGkH8INRKaidFLDTq7bHL6j4nurnKwHyk9utc8qrZ6VHBQjvqZSx3V22f3khNZSqJbs6W4QLC6LduP9Xj6msnWiQ8RBCtod2BwgP40vbxF9YgyCWxu4OsbgDuKtVYvqWqkZbMW21S9s3zHMwx2atoztsE6MJrVHSaX4tjk2x3q7T/fHSto1e559bANawOmhmjnQPGwZT3FbJ3POlFxdmSUxBQAUAFACUAYPirUvsdl5UZxJJwKyqysrHXg6PtJ3eyOS0m0N3dDeMqvJrgrT5UetWnyxOqChQAowBXmt3PPYuKBBigAxTAR13Iyg4JFC0YLRnLSL5NwUuATg/nXqQkmro9Fe9G8TsNFs9LlgWWBFdu+7qK7KajbQ8nEVKsXaTNlUVBhVAHsK1ORtsdQAUAFABQAUAFABQAUAFABQAUAFABQAlABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAeb/Fz/AJhH/bb/ANkr53Pf+Xfz/Q+dz3/l38/0PSK+iPogoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgBaAEoAKAFoAKACgBCQBknigDlPEXiTyS1tZN83Rn9KxqVLaI9HC4Pm96Zy8EE99N8uXYnljXJOoo7npSlGmjobHRoYAGlHmP8ApXHOu3scc68pbGkqqgwqgD2rBybMHruLmlcAoASi4FW5063uVO+MAnuKuNWUdjWFWUTCv'
const yrcLogoSeg5 = '9FltiXj+eP+VddOupHXTrqWnUdo+sz6dKBktF/EprrhUcSa+HjVXmd9ZXkV7AssLZB/SutNNHiVKbpvlZYpkBQAUAITgZNAHnHiK9N5qchB+VDtFcdSV2e9hafs6aNfRLbyLQMfvPya8yvO8jCvPmkaFYGAtAC0AQ3EoiKA/wATYqoxuOKuS1Iijqdgl5GSBiQdDW1Kq4M2pVHBmHZX1xpd1wSpU4ZfWvSpz6o6qlONaOp6Dp94l9aJPH0Ycj0Ndqd1c8KpTdOTiyzTICgAoAKACgAoAKACgAoAKACgAoAKAEoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgDzf4uf8wj/tt/7JXzue/8u/n+h87nv/Lv5/oekV9EfRBQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAC0AFABQBzninWfskJtoG/euOSOwrKpO2iO3B4f2j5pbHHWdpJez7FBOTljXFUnyq5605qCOss7SO1iCRj6n1rz5zcmefObk7snrMgKYC0AJQAUgFoAMZ4oQGHrOlAKbiBcf3lFdlGtfRnXQrX92RB4e1hrC6VHJ8lzhh6V3052ZWKw6qxv1R6Cjh1DKcgjIrrPCas7MdQAUAUNZufsunSyZwdvFRN2ia0Ic9RI87tYzc3ajrubmuCcrJs9+b5YnYooVQo6AYrzG7s8x6i0hC0ALQIztcytqsi9UYGt6GsrG1DWVi1azLPAkgOcis5x5XYmUeV2JagkwPEcCrJHKOC3Bruwsrpo7MNK6aNfwTMzQTxE8KcivSpM4swirpnU1seeFABQAUAFABQAUAFABQAUAFACUALQAlABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAeb/ABc/5hH/AG2/9kr53Pf+Xfz/AEPnc9/5d/P9D0ivoj6IKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAWgAoAgvblbW1kmY/dXNJuyuVTg5yUTzW5mkvbppGyWduK4Zyvqz6CEVTjZHTaZZLaWyjHztyxrz6s+ZnDUm5st1gZkFxeQW4/eSAH0q405S2LjTlLZGdJ4ggU4RGat1hpdTdYZ9SMeIkz/AKk0/qz7j+q+Zattat5jhsp9aiVCSM5YeS2NBJEkXcjBgfSsGrbmLTW46kIKAAgEEEZBp3sByetWf2S6JQYR+R7V6FGpzI9GhU54nU+D9RNzZtbyNl4umfSu+lK6seZj6XJLmXU6OtjhCgDm/GcpTT0jH8bVjWeh35fG82znvD0O67L44UV52Ifu2PQxMrRsdJXAcAtMApALQIiuYRPC8bdGGKqMuV3KhLldznLe9m0uZoXBZAehrtlCNVXO6UFVV0ag1u2K5OQfSsPq8rmHsJGRqN8b6ZcD5RworspU+RWOinT9mjrPCtg1pZNJIMPKc49q7aUbI8rGVeeVl0N6tTkCgAoAKACgAoAKACgAoAKAEoAWgAoAKAEoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAPN/i5/zCP+23/slfO57/y7+f6Hzue/8u/n+h6RX0R9EFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUALQAUAcv4zvfKt47ZTy5yawrS0sehgKd25GLoFqJZzIwyqfzrgrysrHbXnZWOhkkWNC7sFUetcSTlscaTbsjB1DWnfKW/yr03etdVPDpas7aWH'
const yrcLogoSeg6 = 'S1kZ8Flc3zZUEjuzVrKcYGsqkaaNa30CJOZnLn0Fc8sS+hzSxTeyLiaZaJ0hB+tZutJ9TF1pvqP/ALPtSMeQv4Uvay7i9rPuLFYxQsDEWT2zxSlNy3G6jluWazMxKACgDP1228+yZgPmTmt6ErSNsPPlkZfhi6NrqcfOFf5TXp0pWZvi4c9NnoorsPCCgDkfGkmZYIs9Bmuau9T1MvWjZX8OxgRSP6nFebiHrY1xL1SNeuU5hKACgBKQBQBUvtPivUw4w/ZhWlOo4M0p1XA5i+spbOTbIMr2YV6FOamro76c1NXRu+E4LCeT96N068gN0NdVJRZx46VSK02O1AwMAYFdB5AtABQAUAFABQAUAFABQAUAFACUAFAC0AFACUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAHm/xc/5hH/bb/wBkr53Pf+Xfz/Q+dz3/AJd/P9D0ivoj6IKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAWgAoA888V3Bm1VxnhOBXJVd5HuYKHLTRf0gpa6aJZDjdzXm1W5TsiK15zsjM1HUnvHIB2xjoPWuinTUEb0qSgvMXStON2++TiNf1pVavJohVqvJotzpERI0CooVR6VwttnC227sWkISgAoAWkAUAFABQA2VN8bqehFVF2Y07M5OJfs94MdUf+tepB7M9GXvRPS4H3QRsT1UGu9bHz0lZtFW81a0swfNlXPoKlzSNadCdTZHF69qaahdiSIHaowM1zVJ8zPXwtF0o2ZBZ6rLaRlEVSCe9c06aluXOipu5cXxC38cQ/Csvq66MyeG8yxDr1u+N6lKh4aS2IeGkti/DcxTDMbhqxlFx3MZRcdyWpJCgYUCIbq2S6haOQZz0PpVQm4u6KhNwd0cs8c2m3gwxVkPBHevSp1L6o9FONWJ3+i6kmo2SyA/OvDD3rvhLmR4Vek6UrGjVGIUAFABQAUAFABQAUAJQAtACUAFAC0AFABQAlABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAHm/xc/5hH/bb/2Svnc9/wCXfz/Q+dz3/l38/wBD0ivoj6IKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAWgBr8KT7UAeY6s2/Upye7muGe7Po6KtTQ66vGljjiXiNBjHrWUKdncIQs22RW0TTyrGvVjVSfKrlTlyq510ESwQrGo4ArzZy5meZJ8zuySpJCgBKACgBaACgAoAKAFFNAcnfkJfy/72a9Kl8KPRp6wRfuvEdzLbxwQ/u1VQpI6mt3UbVkYQwkYycpakNrpF9qDBgjYP8T9KShKRc8RTpaNmtB4O6Ge4/BRWiodzklmH8qLaeEbJfvO5/Gq9hEyePqdBsnhCyYfLJIPxo9ihrMJrdGdd+DpkGbaYP7GpdF9Dop5hF/ErGLNBd6dNiRXjI6VhKHRo7YyhVV1qaem60HxHccHoGrjq4e2sTnq0LaxNoEEAjkGuU5QoAWgRn61ZC4tjIo/eR8/UVvRnys2oVOWVuhS8MagbO9WNjiKXg59a9OjOzNMbS54XW6O+6jius8UKACgAoAKACgAoAKACgAoASgBRQAUAFABQAUAJQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAHm/wAXP+YR/wBtv/ZK+dz3/l38/wBD53Pf+Xfz/Q9Ir6I+iCgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACg'
const yrcLogoSeg7 = 'AoAKAFoAKAEoAWgBr/cb6UAjzDUFP26f/AHzXDLc+jpP3ERGJggcqdp4zSsVza2NPw/EGuHkP8IrnxErKxhiHpY6EVwnEFADJJo4/vuBVKLew1FvYgGo2xYKJMk+lU6UkX7KRaByKzMwzQAuaBBmgAoAZPOtvC0jnAAq4R5nYcYuTsjkn8y8um2LlpG4Ar00rJJHpK0I69Dr9F8ORWyLNdgPIecHoK6YUktWeViMZKbtDY1Zr2OEbIlBI9K562NjDSOrOeNJy1ZSkvpn/AIto9q4JYurLqbKlFERmlPWQ1k6k31L5Y9hRcSjpIaca1RbSFyRfQmiv5F4fkV008dOPxamcqKexakjttQhKSIHBHfqK9KnVhWWhknOk7o47XtAewbzYMtCT19KzqU+XVHrYbFKqrPcdomonIt5m/wB0159el9pBXpfaRuVynIFIAOCCD0NUtBHI6hGbW9dV4AbcK9GlK6TPTpvnhqegaNdfa9Nhkzk7cGvQi7o8KvDkm0X6oyCgAoAKACgAoAKACgBKACgBaACgAoAKACgBKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoA83+Ln/MI/7bf+yV87nv8Ay7+f6Hzue/8ALv5/oekV9EfRBQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUALQAlABQAUALQAjcgj2oA8/ksHu9dmt0HVySfQVyct5WPbVZU6Kky74qt47SK0t4lwqjJ9zVVVayMcFJzcpMi8PLiGRsdTXm4l6muI3RpXFxHboWkbArnjByehhGDk7IwbzWpZSVh+RfXvXZCgludkMOluUVaSeQLkszVs7RRs7RR0Wn6fHaoGYBpD1PpXDUqOTOGpVc/Qu5rEysGaBBmgBQaYC5oEYGvXZkmECn5V6120I2Vztw8LLmNnwlpapD9smX5m+7nsK9ClDqcWOr3fIjVvroljGh471w4zEtvkiYUqfVlCvOOgKBBTAKAFoAdHI0bBlOKqnUlTldCklJWZrL5d7asjgEMMEV71KoqsLnG705XR5/qtm+m37oOADlT7VzVIWdj3KNRVYJm/p90Lm1R889DXmVI8rsclSHJKxYzUEBmgRzniRMXKP/AHlrtwz0O7CvSx0HgqUvpzoT91q9Kk9Dz8wjadzpa1OEKACgAoAKACgAoAKAEoAKAFoAKACgAoAKACgBKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgDzf4uf8AMI/7bf8AslfO57/y7+f6Hzue/wDLv5/oekV9EfRBQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUALQAUAFACUALQAlAFa3sILeeWdF/eSnLE1KikXKo5JJ9DmfG3E1uf9msa256OXbMp6PcJBYyO5wAa82tFykkjetFymkjLvLqW9mzyR0VRXRTpqKsjphBU0QywvC22RSrdcGtHoNSUtUauiW4AM7DnoK5K8+hz15dDYDVynNYXdSFYXdQAZoAXNArCPJtRm9BTSuwSu7HKAtd3wB5LvXpwjayPRdoQ9D0XAtLBUXjaoArprT9nTbPAX7ydzKyScnvXgN3O2wUAFABQIWmAUwCkBbsJfLl2no1d2Cq8s+XuY1Y3VzN8aWoa2juQPmU4NehWWlzbL52k4mN4fuCJHhJ4PIrzcRHS524iN1c3M1yHIGaBGF4kOXi+ldmG6nZhepr+Bv8Aj3n+telSOTMfiR1dbHmhQAUAFABQAUAFABQAlABQAUALQAZoAM0AJQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFA'
const yrcLogoSeg8 = 'BQAUAFABQAUAFABQAUAFABQB5v8XP+YR/22/8AZK+dz3/l38/0Pnc9/wCXfz/Q9Ir6I+iCgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAFoASgAoAKACgBaAOS8cr8lu/viuesenlz1aOT81tmzJ256Vhy63PUsr3Ou8K6IEQXtyuSfuKa6KcOrPKxuJv7kTB11y+qXBP8AexWM37zO3DK1NGnYDbbRgeledVd5MyqayZaBrMyFzSsAbqLBYUGgVhc0AV76TZayHPatKavJF01eSMfw9H5urQAjoc16cFqdGKdqTO41VtsaL6ms8wlaCR5GHWrZmZryTqFzQIWgBaYBmgQZpgGaABW2sp9DTi+WSYNXRb1uMXOjy98Lmvel70LnPh5clVHC6dJ5V5GenOK4KivFnt1FeLOoDVwHni5oEYOvOHuAv90V3YdWR2YdWR0ng2AxaYzkY3tXoUloedj5XqWOhrU4goAKACgAoAKACgAoAKAEoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgDzf4uf8AMI/7bf8AslfO57/y7+f6Hzue/wDLv5/oekV9EfRBQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFAC0AFABQAUAFABQBz3jGAy6YHAyUOayrLQ7cBK1SxzHh3TDqN6u4fu4zlqxhHmZ6WLreyh5no0aBECqMADAFdZ4Dd9TzfWEI1K4B/v1xT3Z9Bh3+7RrW2BbxntivOmveMJ7srXWprEdsQ3N61pCjfcuFJvcoNdTzMBvOT2FbKEYo2UIxNi0jMMQVmLMeSTXJN3ZyzfMybdUE2F3UCsU9UfFm/vWtFe8a0V7xX8Jru1ZPZSa9KnuPHO1I6rWWw0YrnzDoefhlozODV5tjosLuoCw4GgVg3UwsG6gLBuoCwhamFgLUgNaIefpzKe6EV7lB81JHFL3alzzxx5dyf8AZauaSPfWsTpom3Ip9RXnyWpwNaivIEQsTwBRFXYkrs5yV2u7vjku2BXpU42SR3JckT0XTbYWtjDCB0UZrtirI8GrPnm2WqozCgAoAKACgAoAKACgAoAKACgAoAKACgAoASgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAPN/i5/zCP+23/slfO57/AMu/n+h87nv/AC7+f6HpFfRH0QUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUALQAUAFABQAUAFABQAlAFbUbb7XZyw93XAqZK6sXSnySUiroWlLpdmIzgyE5ZvWlCPKjXE13Wlc1Ks5zgPFEPk6rIccP8wrkqK0j28HK9NFI3zm2WJTjH61z+zXNc29mua5NHpcrWL3jjZGOme9a8jtch11z8i3I9OQNc5PRRmsKrtEuo7I191chz2DdRYVhd1KwrFLVm/wBF/GtqHxGtFe8S+DUzqLNjolejR3MswfuJG9rbfv0HtXLjviRy4Ve6zOBrgOmwoaiwrDt1FgsG+iwWDfQFhN9MLCb6LCsLuosFjZ0dt9uV9DivXwbvCxxYhWkcRrEPk6jOvTDZrOorSZ7GHlzU0a1m263jPtXBNanPUVpMz9YvP+WCH61vRp9Wb0af2mW/COmefObqQfu4+me5rvpRu7mGOrcq5V1O4roPICgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgBKAFoAKAEoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAPN/i5/zCP+23/slfO'
// Use the public asset copy (created as /public/yrclogo.jpg)
// Keep the variable name for compatibility with existing usage in this file
const yrcLogoBase64 = '/yrclogo.jpg'

/**
 * Get current Philippines time (UTC+8)
 * Always returns the correct time regardless of device timezone
 */
const getPHTime = (): Date => {
  const now = new Date()
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000
  const phTime = new Date(utcTime + 8 * 60 * 60 * 1000) // UTC+8 is 8 hours ahead
  return phTime
}

/**
 * Format current date in Philippines timezone
 */
const todayLabel = () => {
  const phTime = getPHTime()
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila'
  }
  return phTime.toLocaleDateString('en-PH', options)
}

/**
 * Format current time in Philippines timezone
 */
const nowLabel = () => {
  const phTime = getPHTime()
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila'
  }
  return phTime.toLocaleTimeString('en-PH', options)
}

/**
 * Format a date for Philippines timezone
 */
const formatPHDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila'
  }
  return date.toLocaleString('en-PH', options)
}

/**
 * Format cook time (HH:MM format) to readable time label
 */
const formatCookTime = (cookTime?: string): string => {
  if (!cookTime) return 'TBD'
  try {
    const [hours, minutes] = cookTime.split(':').map(Number)
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    }
    return date.toLocaleTimeString('en-PH', options)
  } catch (e) {
    return cookTime
  }
}

/**
 * Parse a date string as LOCAL time, not UTC
 * Handles both "YYYY-MM-DD" format and ISO timestamps
 */
export const parseLocalDate = (dateString: string): Date => {
  // If it's ISO format with T (has time component), parse normally
  if (dateString.includes('T')) {
    return new Date(dateString)
  }
  
  // Otherwise assume YYYY-MM-DD format and parse as local time
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// default interval for kitchen reminders (milliseconds)
let REMINDER_INTERVAL = 30 * 60 * 1000 // 30 minutes, can be adjusted via setReminderInterval()

// helper for tracking which orders have already triggered a notification
const NOTIFIED_ORDERS_KEY = 'yellowbell_notified_orders'
const getNotifiedOrders = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(NOTIFIED_ORDERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const addNotifiedOrders = (ids: string[]) => {
  if (typeof window === 'undefined') return
  const existing = new Set(getNotifiedOrders())
  ids.forEach(id => existing.add(id))
  localStorage.setItem(NOTIFIED_ORDERS_KEY, JSON.stringify(Array.from(existing)))
}

// state used by food preparation reminders
interface EmailNotificationState {
  lastReminderTime: number
  remindersCount: number
  hasOrdersToday: boolean
}
let notificationState: EmailNotificationState = {
  lastReminderTime: 0,
  remindersCount: 0,
  hasOrdersToday: false,
}

/** Yellow Roast Co. branded email wrapper with meal-type color scheme
 *  Breakfast → warm yellow/amber
 *  Lunch     → sky blue
 *  Dinner    → deep red (YRC brand)
 *  Default   → YRC orange/red
 */
const headerColorsForMeal = (mealType?: string) => {
  const mt = (mealType || '').toLowerCase()
  if (mt === 'breakfast') {
    return {
      headerBg:     'linear-gradient(135deg, #f59e0b 0%, #fbbf24 60%, #fde68a 100%)',
      accentColor:  '#92400e',
      badgeBg:      '#fef3c7',
      badgeText:    '#92400e',
      badgeBorder:  '#fcd34d',
      tableThead:   '#fef3c7',
      theadText:    '#78350f',
      tableRow1:    '#fffbeb',
      tableRow2:    '#fef9f0',
      tableAccent:  '#f59e0b',
      footerBg:     '#fef3c7',
      footerBorder: '#fcd34d',
      footerText:   '#92400e',
      iconEmoji:    '🌅',
      label:        'BREAKFAST ORDER',
    }
  }
  if (mt === 'lunch') {
    return {
      headerBg:     'linear-gradient(135deg, #0284c7 0%, #38bdf8 60%, #bae6fd 100%)',
      accentColor:  '#0c4a6e',
      badgeBg:      '#e0f2fe',
      badgeText:    '#0c4a6e',
      badgeBorder:  '#7dd3fc',
      tableThead:   '#e0f2fe',
      theadText:    '#0c4a6e',
      tableRow1:    '#f0f9ff',
      tableRow2:    '#e0f2fe',
      tableAccent:  '#0284c7',
      footerBg:     '#e0f2fe',
      footerBorder: '#7dd3fc',
      footerText:   '#0c4a6e',
      iconEmoji:    '☀️',
      label:        'LUNCH ORDER',
    }
  }
  // dinner | default — YRC brand red
  return {
    headerBg:     'linear-gradient(135deg, #991b1b 0%, #dc2626 60%, #ef4444 100%)',
    accentColor:  '#7f1d1d',
    badgeBg:      '#fee2e2',
    badgeText:    '#7f1d1d',
    badgeBorder:  '#fca5a5',
    tableThead:   '#fee2e2',
    theadText:    '#7f1d1d',
    tableRow1:    '#fff5f5',
    tableRow2:    '#fef2f2',
    tableAccent:  '#dc2626',
    footerBg:     '#fee2e2',
    footerBorder: '#fca5a5',
    footerText:   '#7f1d1d',
    iconEmoji:    '🌙',
    label:        'DINNER ORDER',
  }
}

/** Render a clean styled order row for use inside the email table */
const renderOrderRow = (o: CustomerOrder, colors: ReturnType<typeof headerColorsForMeal>, isAlt: boolean) => {
  const items = (o.orderedItems || []).map((i: any) => `<strong>${i.quantity}×</strong> ${i.name}`).join(', ')
  const delivTime = o.cookTime ? formatCookTime(o.cookTime) : '—'
  const payment = (o.paymentStatus === 'paid')
    ? `<span style="color:#16a34a;font-weight:600;">✓ Paid</span>`
    : `<span style="color:#dc2626;font-weight:600;">Unpaid</span>`
  return `
    <tr style="background:${isAlt ? colors.tableRow2 : colors.tableRow1};">
      <td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};font-weight:600;color:#1f2937;">
        ${o.customerName}
        ${o.orderNumber ? `<br><span style="font-size:11px;color:#6b7280;font-weight:400;">#${o.orderNumber}</span>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};color:#374151;font-size:13px;">${items}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};color:${colors.tableAccent};font-weight:700;font-size:14px;">${delivTime}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};font-size:13px;">${payment}</td>
    </tr>`
}

const emailWrapper = (content: string, mealType?: string) => {
  const colors = headerColorsForMeal(mealType)
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Yellow Roast Co.</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12);max-width:620px;">

        <!-- ═══ HEADER ═══ -->
        <tr>
          <td style="background:${colors.headerBg};padding:36px 40px;text-align:center;">
            <img src="${yrcLogoBase64}" alt="Yellow Roast Co." width="72" height="72"
                 style="border-radius:12px;border:3px solid rgba(255,255,255,0.35);margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;"/>
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:0.5px;text-shadow:0 1px 4px rgba(0,0,0,0.2);">
              Yellow Roast Co.
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.88);font-size:13px;letter-spacing:1.2px;font-weight:500;">
              ${colors.label} &nbsp;·&nbsp; ${colors.iconEmoji} &nbsp;KITCHEN NOTIFICATION
            </p>
          </td>
        </tr>

        <!-- ═══ TIMESTAMP STRIP ═══ -->
        <tr>
          <td style="background:${colors.badgeBg};padding:10px 40px;border-bottom:1px solid ${colors.badgeBorder};">
            <p style="margin:0;color:${colors.badgeText};font-size:12px;font-weight:600;letter-spacing:0.5px;">
              📅 ${todayLabel()} &nbsp;&nbsp;🕐 ${nowLabel()} &nbsp;(Asia/Manila)
            </p>
          </td>
        </tr>

        <!-- ═══ BODY CONTENT ═══ -->
        <tr>
          <td style="padding:36px 40px;">
            ${content}
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="background:${colors.footerBg};padding:20px 40px;text-align:center;border-top:2px solid ${colors.footerBorder};">
            <p style="margin:0 0 4px;color:${colors.footerText};font-size:12px;font-weight:700;letter-spacing:0.5px;">
              🐔 YELLOW ROAST CO. — INVENTORY SYSTEM
            </p>
            <p style="margin:0;color:${colors.footerText};font-size:11px;opacity:0.75;">
              This is an automated notification. Do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`
}

/** Shared styled order table for use inside email body */
const renderOrderTable = (orders: CustomerOrder[], colors: ReturnType<typeof headerColorsForMeal>) => {
  if (!orders.length) return ''
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid ${colors.badgeBorder};margin-top:8px;">
    <thead>
      <tr style="background:${colors.tableThead};">
        <th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Customer</th>
        <th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Items Ordered</th>
        <th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Delivery Time</th>
        <th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Payment</th>
      </tr>
    </thead>
    <tbody>
      ${orders.map((o, i) => renderOrderRow(o, colors, i % 2 === 1)).join('')}
    </tbody>
  </table>`
}


/**
 * Group orders by delivery time buckets (1hr, 2+hrs, 3+ days)
 * Returns grouped HTML table sections with customer name, food ordered, date, and delivery time
 */
const groupOrdersByDeliveryTime = (orders: CustomerOrder[]): string => {
  if (orders.length === 0) return ''

  const now = getPHTime()
  const groups: { [key: string]: CustomerOrder[] } = {
    'within_1hr': [],
    '1_to_2hrs': [],
    'above_2hrs': [],
    '3_days_advance': []
  }

  orders.forEach(order => {
    if (!order.cookTime) {
      groups['within_1hr'].push(order)
      return
    }

    const deliveryDate = parseLocalDate(order.createdAt)
    const [hours, minutes] = order.cookTime.split(':').map(Number)
    deliveryDate.setHours(hours, minutes, 0, 0)

    const timeUntilDelivery = deliveryDate.getTime() - now.getTime()
    const hoursUntilDelivery = timeUntilDelivery / (1000 * 60 * 60)
    const daysUntilDelivery = timeUntilDelivery / (1000 * 60 * 60 * 24)

    if (hoursUntilDelivery <= 1 && hoursUntilDelivery > 0) {
      groups['within_1hr'].push(order)
    } else if (hoursUntilDelivery <= 2 && hoursUntilDelivery > 1) {
      groups['1_to_2hrs'].push(order)
    } else if (daysUntilDelivery >= 2 && daysUntilDelivery <= 3) {
      groups['3_days_advance'].push(order)
    } else {
      groups['above_2hrs'].push(order)
    }
  })

  let html = ''

  // 1 Hour Due Table
  if (groups['within_1hr'].length > 0) {
    html += `
      <div style="margin-bottom: 28px;">
        <h3 style="color: #dc2626; font-size: 16px; margin: 0 0 12px; display: flex; align-items: center;">
          <span style="font-size: 20px; margin-right: 8px;">⏰</span>
          1 Hour Due
        </h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <thead>
            <tr style="background-color: #fee2e2; border: 1px solid #fca5a5;">
              <th style="padding: 10px; text-align: left; color: #991b1b; font-size: 13px; font-weight: 600;">Customer Name</th>
              <th style="padding: 10px; text-align: left; color: #991b1b; font-size: 13px; font-weight: 600;">Food Ordered</th>
              <th style="padding: 10px; text-align: left; color: #991b1b; font-size: 13px; font-weight: 600;">Date Today</th>
              <th style="padding: 10px; text-align: left; color: #991b1b; font-size: 13px; font-weight: 600;">Delivery Time</th>
            </tr>
          </thead>
          <tbody>
            ${groups['within_1hr'].map(o => `
              <tr style="border: 1px solid #fca5a5; background-color: #fef2f2;">
                <td style="padding: 10px; color: #374151;">${o.customerName}</td>
                <td style="padding: 10px; color: #374151;">${o.orderedItems.map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}</td>
                <td style="padding: 10px; color: #374151;">${o.createdAt || 'Today'}</td>
                <td style="padding: 10px; color: #dc2626; font-weight: 600;">${o.cookTime || 'Immediate'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  // 2+ Hours Due Table
  if (groups['above_2hrs'].length > 0) {
    html += `
      <div style="margin-bottom: 28px;">
        <h3 style="color: #ea580c; font-size: 16px; margin: 0 0 12px; display: flex; align-items: center;">
          <span style="font-size: 20px; margin-right: 8px;">⏱️</span>
          2+ Hours Due
        </h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <thead>
            <tr style="background-color: #fed7aa; border: 1px solid #fdba74;">
              <th style="padding: 10px; text-align: left; color: #85400f; font-size: 13px; font-weight: 600;">Customer Name</th>
              <th style="padding: 10px; text-align: left; color: #85400f; font-size: 13px; font-weight: 600;">Food Ordered</th>
              <th style="padding: 10px; text-align: left; color: #85400f; font-size: 13px; font-weight: 600;">Date Today</th>
              <th style="padding: 10px; text-align: left; color: #85400f; font-size: 13px; font-weight: 600;">Delivery Time</th>
            </tr>
          </thead>
          <tbody>
            ${groups['above_2hrs'].map(o => `
              <tr style="border: 1px solid #fdba74; background-color: #fffbeb;">
                <td style="padding: 10px; color: #374151;">${o.customerName}</td>
                <td style="padding: 10px; color: #374151;">${o.orderedItems.map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}</td>
                <td style="padding: 10px; color: #374151;">${o.createdAt || 'Today'}</td>
                <td style="padding: 10px; color: #ea580c; font-weight: 600;">${o.cookTime || 'Not set'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  // 3+ Days Advance Table
  if (groups['3_days_advance'].length > 0) {
    html += `
      <div style="margin-bottom: 28px;">
        <h3 style="color: #0284c7; font-size: 16px; margin: 0 0 12px; display: flex; align-items: center;">
          <span style="font-size: 20px; margin-right: 8px;">📅</span>
          3 Days Advance
        </h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <thead>
            <tr style="background-color: #bfdbfe; border: 1px solid #93c5fd;">
              <th style="padding: 10px; text-align: left; color: #0c4a6e; font-size: 13px; font-weight: 600;">Customer Name</th>
              <th style="padding: 10px; text-align: left; color: #0c4a6e; font-size: 13px; font-weight: 600;">Food Ordered</th>
              <th style="padding: 10px; text-align: left; color: #0c4a6e; font-size: 13px; font-weight: 600;">Delivery Date</th>
              <th style="padding: 10px; text-align: left; color: #0c4a6e; font-size: 13px; font-weight: 600;">Delivery Time</th>
            </tr>
          </thead>
          <tbody>
            ${groups['3_days_advance'].map(o => {
              const deliveryDate = parseLocalDate(o.createdAt)
              const dateLabel = deliveryDate.toLocaleDateString('en-PH', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })
              return `
              <tr style="border: 1px solid #93c5fd; background-color: #f0f9ff;">
                <td style="padding: 10px; color: #374151;">${o.customerName}</td>
                <td style="padding: 10px; color: #374151;">${o.orderedItems.map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}</td>
                <td style="padding: 10px; color: #374151;">${dateLabel}</td>
                <td style="padding: 10px; color: #0284c7; font-weight: 600;">${o.cookTime || 'Not set'}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  return html

}

/**
 * Format order details for email
 */
const formatOrderDetailsForEmail = (orders: CustomerOrder[]): string => {
  let details = `<table width="100%" cellpadding="0" cellspacing="0">`

  const incompleteOrders = orders.filter(o => o.status !== 'complete' && o.status !== 'delivered')

  incompleteOrders.forEach(order => {
    const pendingItems = order.orderedItems
      .map(item => {
        const cooked = order.cookedItems?.find(c => c.name === item.name)
        const cookedQty = cooked?.quantity || 0
        const remaining = item.quantity - cookedQty
        return remaining > 0 ? `<li style="margin:2px 0;color:#374151">${remaining}\u00d7 ${item.name}</li>` : null
      })
      .filter(Boolean)
      .join('')

    if (pendingItems) {
      details += `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
            <strong style="color:#1f2937;font-size:15px">${order.customerName}</strong>
            <span style="color:#6b7280;font-size:12px;margin-left:8px">Order #${order.orderNumber || order.id}</span>
            <ul style="margin:6px 0 0 16px;padding:0;font-size:14px">${pendingItems}</ul>
          </td>
        </tr>`
    }
  })

  details += `</table>`
  return details
}

const sendEmailNotification = async (
  subject: string,
  htmlBody: string,
  plainTextBody: string,
  recipientEmail: string,
  retryCount = 0,
  maxRetries = 3
): Promise<boolean> => {
  try {
    if (typeof window === 'undefined') {
      console.warn('[email-notifications] ❌ Cannot send email - running on server')
      return false
    }

    console.log('[email-notifications] 📨 Sending email:', { 
      to: recipientEmail, 
      subject,
      bodyLength: htmlBody.length,
      attempt: retryCount + 1,
      maxRetries
    })

    // Add a small delay before firing the request to ensure readiness
    await new Promise(resolve => setTimeout(resolve, 100))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    try {
      const response = await fetch('/api/send-notification-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          subject, 
          htmlBody, 
          plainTextBody, 
          recipientEmail, 
          timestamp: formatPHDate(getPHTime()),
          clientTimezone: 'Asia/Manila'
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log('[email-notifications] API Response Status:', response.status)

      const data = await response.json().catch(() => ({}))
      
      console.log('[email-notifications] API Response Data:', data)
      
      if (response.ok && (data.success === undefined || data.success)) {
        console.log(`✅ [email-notifications] Sent: ${subject}`)
        return true
      }

      // API returned a failure flag or non-OK status
      const errorMsg = data.message || response.statusText || 'unknown'
      console.warn(`❌ [email-notifications] Failed (attempt ${retryCount + 1}/${maxRetries + 1}): ${errorMsg}`, data)
      
      // Retry on network-related errors
      if (retryCount < maxRetries && (response.status >= 500 || !response.ok)) {
        const delayMs = 1000 * Math.pow(2, retryCount) // Exponential backoff
        console.log(`[email-notifications] Retrying in ${delayMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        return sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail, retryCount + 1, maxRetries)
      }

      return false
    } catch (fetchError) {
      clearTimeout(timeoutId)
      
      // Handle abort and network errors
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          console.error('❌ [email-notifications] Request timeout after 15 seconds')
          if (retryCount < maxRetries) {
            console.log(`[email-notifications] Retrying after timeout (attempt ${retryCount + 2}/${maxRetries + 1})...`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            return sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail, retryCount + 1, maxRetries)
          }
        } else if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
          console.error(`❌ [email-notifications] Network error (attempt ${retryCount + 1}/${maxRetries + 1}):`, fetchError.message)
          if (retryCount < maxRetries) {
            const delayMs = 1000 * Math.pow(2, retryCount)
            console.log(`[email-notifications] Retrying in ${delayMs}ms...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
            return sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail, retryCount + 1, maxRetries)
          }
        } else {
          console.error('❌ [email-notifications] Fetch error:', fetchError.message)
        }
      }

      return false
    }
  } catch (error) {
    console.error('❌ [email-notifications] Unexpected error:', error)
    return false
  }
}

/**
 * Check if we should send a reminder notification
 * Sends reminder if:
 * - There are orders for today
 * - We haven't sent a reminder in the last 30 minutes (or configured interval)
 */
export const checkAndSendFoodPreparationReminder = async (orders: CustomerOrder[], recipientEmail?: string): Promise<void> => {
  try {
    console.log('[email-notifications] checkAndSendFoodPreparationReminder called:', {
      ordersCount: orders.length,
      hasRecipient: !!recipientEmail
    })
    
    // Get current time
    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Filter today's orders that are not yet complete or delivered
    const todayOrders = orders.filter(order => {
      const orderDate = parseLocalDate(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate.getTime() === today.getTime() && 
             order.status !== 'complete' && 
             order.status !== 'delivered'
    })

    // Also gather any future/advanced orders (for awareness)
    const advancedOrders = orders.filter(order => {
      const orderDate = parseLocalDate(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate.getTime() > today.getTime() &&
             order.status !== 'complete' &&
             order.status !== 'delivered'
    })

    notificationState.hasOrdersToday = todayOrders.length > 0 || advancedOrders.length > 0

    console.log('[email-notifications] Food prep reminder check:', {
      todayOrders: todayOrders.length,
      advancedOrders: advancedOrders.length,
      hasOrders: notificationState.hasOrdersToday
    })

    // Only send reminder if there are orders (today or advanced) and interval passed
    if (!notificationState.hasOrdersToday) {
      console.log('[email-notifications] ⏭️ No orders to remind about')
      return
    }

    const timeSinceLastReminder = notificationState.lastReminderTime 
      ? now.getTime() - notificationState.lastReminderTime 
      : Infinity

    if (timeSinceLastReminder < REMINDER_INTERVAL) {
      return // Not enough time has passed
    }

    // Send reminder email
    const reminderNumber = notificationState.remindersCount + 1
    const subject = `🐔 YRC Kitchen Reminder #${reminderNumber} — ${todayOrders.length} Order${todayOrders.length > 1 ? 's' : ''} Today`
    
    // Detect meal type from the majority of orders
    const mealTypeCounts: Record<string, number> = {}
    todayOrders.forEach(o => {
      const mt = (o.mealType || o.originalMealType || 'dinner').toLowerCase()
      mealTypeCounts[mt] = (mealTypeCounts[mt] || 0) + 1
    })
    const dominantMealType = Object.entries(mealTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'dinner'
    const colors = headerColorsForMeal(dominantMealType)

    const ordersTableHtml = renderOrderTable(todayOrders as unknown as CustomerOrder[], colors)

    const content = `
      <div style="margin-bottom:24px;">
        <div style="display:inline-block;background:${colors.badgeBg};border:1px solid ${colors.badgeBorder};border-radius:8px;padding:8px 16px;margin-bottom:16px;">
          <span style="color:${colors.badgeText};font-weight:700;font-size:13px;">🔔 REMINDER #${reminderNumber}</span>
        </div>
        <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:800;">
          ${todayOrders.length} Order${todayOrders.length > 1 ? 's' : ''} Need Preparation
        </h2>
        <p style="margin:0;color:#6b7280;font-size:14px;">
          Please prepare all pending orders before their delivery time.
          Next reminder in <strong>${Math.round(REMINDER_INTERVAL / 60000)} minutes</strong>.
        </p>
      </div>

      ${ordersTableHtml}

      <div style="margin-top:20px;padding:14px 18px;background:${colors.badgeBg};border-left:4px solid ${colors.tableAccent};border-radius:0 8px 8px 0;">
        <p style="margin:0;color:${colors.badgeText};font-size:13px;font-weight:600;">
          ⏰ Please ensure all orders are ready before their scheduled delivery time.
        </p>
      </div>
    `

    const htmlBody = emailWrapper(content, dominantMealType)

    const plainTextBody = `
Yellow Roast Co. Kitchen Reminder #${reminderNumber}
${todayLabel()} at ${nowLabel()} (Asia/Manila)

Orders to prepare today:
${todayOrders.map(order => {
  const pendingItems = order.orderedItems
    .map(item => {
      const cooked = order.cookedItems?.find(c => c.name === item.name)
      const cookedQty = cooked?.quantity || 0
      const remaining = item.quantity - cookedQty
      return remaining > 0 ? `${remaining}x ${item.name}` : null
    })
    .filter(Boolean)
    .join(', ')
  return `- ${order.customerName} (Order #${order.orderNumber || order.id}): ${pendingItems} | Delivery: ${order.cookTime || 'TBD'}`
}).join('\n')}

Next reminder: in ${Math.round(REMINDER_INTERVAL / 60000)} minutes
Orders pending: ${todayOrders.length}
    `
    // determine who to send to (fallback to default admin)
    const to = recipientEmail || 'admin@yellowbell.com'
    // Send the email notification
    const sent = await sendEmailNotification(subject, htmlBody, plainTextBody, to)
    
    if (sent) {
      notificationState.lastReminderTime = now.getTime()
      notificationState.remindersCount += 1
      console.log(`[email-notifications] Food preparation reminder #${reminderNumber} sent to ${to}`)
    }

  } catch (error) {
    console.error('[email-notifications] Error checking and sending reminder:', error)
  }
}

/**
 * Reset notification state when it's a new day
 */
export const resetNotificationState = (): void => {
  notificationState = {
    lastReminderTime: 0,
    remindersCount: 0,
    hasOrdersToday: false,
  }
  console.log('[email-notifications] Notification state reset for new day')
}

/**
 * Get current notification state (for debugging)
 */
export const getNotificationState = (): EmailNotificationState => {
  return { ...notificationState }
}

/**
 * Set custom interval for reminders (in milliseconds)
 * Default is 30 minutes (1800000ms)
 * Can be set to 60 minutes (3600000ms) for hourly reminders
 */
export const setReminderInterval = (intervalMs: number): void => {
  REMINDER_INTERVAL = intervalMs
  console.log(`[email-notifications] Reminder interval set to ${intervalMs / 60000} minutes`)
}

/**
 * Retrieve list of administrator email addresses.
 *
 * Reads from the Firebase `users` node and collects all email fields.
 * Falls back to the `ADMIN_EMAIL` environment variable or a default if
 * the database query fails or returns no entries.
 */
export const getAdminEmails = async (): Promise<string[]> => {
  try {
    const snapshot = await get(ref(database, 'users'))
    const users = snapshot.val() || {}
    const emails: string[] = []
    Object.values(users).forEach((u: any) => {
      if (u && typeof u.email === 'string' && u.email.trim()) {
        emails.push(u.email.trim())
      }
    })

    // always include the environment-provided admin email as a fallback
    if (typeof process !== 'undefined' && process.env.ADMIN_EMAIL) {
      emails.push(process.env.ADMIN_EMAIL)
    }

    // de-duplicate
    let uniq = Array.from(new Set(emails))

    if (uniq.length === 0) {
      // still empty: nothing configured in Firebase and env var missing
      const fallback = process.env.ADMIN_EMAIL || 'admin@yellowbell.com'
      console.warn('[email-notifications] No admin emails found in database; using fallback', fallback)
      uniq = [fallback]
    }

    return uniq
  } catch (err) {
    console.error('[email-notifications] Error fetching admin emails:', err)
    const fallback = process.env.ADMIN_EMAIL || 'admin@yellowbell.com'
    return [fallback]
  }
}

/**
 * SCENARIO 1: Immediately notify when a new order for today is placed WITHOUT a time
 * OR for orders with delivery time within 2 hours
 * `order` may be a CustomerOrder or plain Order object – only the
 * date, customerName and items fields are used.
 * If no valid recipientEmail is provided nothing will be sent.
 */
export const sendOrderPlacedNotification = async (
  order: { id?: string; date: string; customerName: string; items: Array<{ name: string; quantity: number }>; cookTime?: string; createdAt?: string; mealType?: string; originalMealType?: string; status?: string; paymentStatus?: string },
  recipientEmail?: string
): Promise<boolean> => {
  console.log('[email-notifications] sendOrderPlacedNotification called:', { recipientEmail, orderId: order.id, orderDate: order.date, cookTime: order.cookTime, status: order.status, paymentStatus: order.paymentStatus })
  
  if (!recipientEmail) {
    console.warn('[email-notifications] ❌ No recipient email provided - email NOT sent')
    return false
  }

  // if the order has already been delivered/completed we don't send anything
  if (order.status === 'delivered' || order.status === 'complete') {
    console.log('[email-notifications] Order already delivered/completed, skipping notification')
    return false
  }
  // if we have an id, verify the order still exists (prevents emailing a just-cancelled order)
  if (order.id) {
    try {
      // avoid circular import problems by requiring lazily
      const { getCustomerOrders } = require('./inventory-store')
      const existing = getCustomerOrders().find((o: any) => o.id === order.id)
      if (!existing) {
        console.log('[email-notifications] ❌ Order no longer exists, skipping new-order email')
        return false
      }
    } catch (err) {
      // if anything goes wrong, fall back to sending so we don't silently swallow
      console.warn('[email-notifications] Could not verify order existence:', err)
    }
  }

  try {
    // Parse the order date
    const orderDate = parseLocalDate(order.date)
    
    // Check if order is for today or within 2 hours
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    orderDate.setHours(0, 0, 0, 0)
    
    const isForToday = orderDate.getTime() === today.getTime()
    const now = new Date()
    
    console.log('[email-notifications] Order date check:', { 
      orderDate: orderDate.toDateString(), 
      today: today.toDateString(),
      isForToday,
      cookTime: order.cookTime || 'not set'
    })
    
    // Skip if not for today
    if (!isForToday) {
      console.log('[email-notifications] ℹ️ Order is not for today - will be handled by advanced notifications')
      return false
    }

    // summary table containing every order scheduled for today
    if (order.id) {
      try {
        // use regular orders (not customer orders) for summary table since
        // they contain `date` and `items` fields we can easily display
        const { getOrders } = require('./orders')
        const { getCustomerOrders } = require('./inventory-store')
        const allOrders = getOrders()
        const allCustomerOrders = getCustomerOrders()

        const toNotify = allOrders.filter((o: any) => {
          if (!o.id) return false
          const od = new Date(o.date)
          // skip orders that have been delivered or completed
          if (o.status === 'delivered' || o.status === 'complete') return false
          // also cross-check customerOrders delivery status
          const custOrder = allCustomerOrders.find((co: any) => co.id === o.id)
          if (custOrder && (custOrder.status === 'delivered' || custOrder.status === 'complete')) return false
          return od.toDateString() === today.toDateString()
        })

        if (toNotify.length === 0) {
          return false
        }


        const subject = `🆕 ${toNotify.length} New Order${toNotify.length > 1 ? 's' : ''} Today — Yellow Roast Co.`

        const mtCounts: Record<string, number> = {}
        toNotify.forEach((o: any) => {
          const mt = (o.mealType || o.originalMealType || 'dinner').toLowerCase()
          mtCounts[mt] = (mtCounts[mt] || 0) + 1
        })
        const todaySummaryMealType = Object.entries(mtCounts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'dinner'
        const todayColors = headerColorsForMeal(todaySummaryMealType)

        const rows = toNotify
          .map((o: any, i: number) => {
            const items = (o.items || []).map((it: any) => `<strong>${it.quantity}×</strong> ${it.name}`).join(', ')
            const time = o.cookTime ? formatCookTime(o.cookTime) : '—'
            const payment = o.paymentStatus === 'paid'
              ? `<span style="color:#16a34a;font-weight:600;">✓ Paid</span>`
              : `<span style="color:#dc2626;font-weight:600;">Unpaid</span>`
            return `<tr style="background:${i % 2 === 0 ? todayColors.tableRow1 : todayColors.tableRow2};">
              <td style="padding:10px 12px;border-bottom:1px solid ${todayColors.badgeBorder};font-weight:600;color:#1f2937;">${o.customerName}</td>
              <td style="padding:10px 12px;border-bottom:1px solid ${todayColors.badgeBorder};color:#374151;font-size:13px;">${items}</td>
              <td style="padding:10px 12px;border-bottom:1px solid ${todayColors.badgeBorder};color:${todayColors.tableAccent};font-weight:700;">${time}</td>
              <td style="padding:10px 12px;border-bottom:1px solid ${todayColors.badgeBorder};font-size:13px;">${payment}</td>
            </tr>`
          })
          .join('')

        const content = `
          <div style="margin-bottom:24px;">
            <div style="display:inline-block;background:${todayColors.badgeBg};border:1px solid ${todayColors.badgeBorder};border-radius:20px;padding:6px 16px;margin-bottom:16px;">
              <span style="color:${todayColors.badgeText};font-weight:700;font-size:12px;letter-spacing:0.5px;">🆕 NEW ORDER${toNotify.length > 1 ? 'S' : ''} RECEIVED</span>
            </div>
            <h2 style="margin:0 0 8px;color:#111827;font-size:24px;font-weight:800;">${toNotify.length} Order${toNotify.length > 1 ? 's' : ''} Placed Today</h2>
            <p style="margin:0;color:#6b7280;font-size:14px;">All orders below are scheduled for today and require preparation.</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid ${todayColors.badgeBorder};">
            <thead>
              <tr style="background:${todayColors.tableThead};">
                <th style="padding:10px 12px;text-align:left;color:${todayColors.theadText};font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Customer</th>
                <th style="padding:10px 12px;text-align:left;color:${todayColors.theadText};font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Items Ordered</th>
                <th style="padding:10px 12px;text-align:left;color:${todayColors.theadText};font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Delivery Time</th>
                <th style="padding:10px 12px;text-align:left;color:${todayColors.theadText};font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Payment</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-top:20px;padding:14px 18px;background:${todayColors.badgeBg};border-left:4px solid ${todayColors.tableAccent};border-radius:0 8px 8px 0;">
            <p style="margin:0;color:${todayColors.badgeText};font-size:13px;font-weight:600;">🍗 Begin preparation to ensure timely delivery for all customers.</p>
          </div>
        `

        const htmlBody = emailWrapper(content, todaySummaryMealType)
        const plainTextBody = `Yellow Roast Co. — ${toNotify.length} Order${toNotify.length > 1 ? 's' : ''} Today\n\n${toNotify
          .map((o: any) =>
            `${o.customerName} | ${(o.items||[]).map((i: any) => `${i.quantity}x ${i.name}`).join(', ')} | Delivery: ${o.cookTime || '—'} | Payment: ${o.paymentStatus || 'unpaid'}`
          )
          .join('\n')}`

        const sent = await sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail)
        if (sent) {
          const ids = toNotify.map((o: any) => o.id).filter(Boolean) as string[]
          addNotifiedOrders(ids)
        }
        return sent
      } catch (e) {
        console.warn('[email-notifications] summary-error', e)
      }
    }

    // SCENARIO 1: If NO time is set, notify immediately
    if (!order.cookTime) {
      const subject = `🆕 New Order Received - Immediate Preparation Required`
      const content = `
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 8px;">🐔</div>
          <h2 style="color: #dc2626; margin: 0; font-size: 24px;">New Order Received</h2>
          <p style="color: #6b7280; margin: 4px 0 0; font-size: 13px;">Received: ${todayLabel()} at ${nowLabel()}</p>
          <p style="color: #ef4444; margin: 8px 0 0; font-size: 13px; font-weight: 600;">🔔 NO TIME SET - IMMEDIATE PREPARATION</p>
        </div>

        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%); padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 5px solid #d97706;">
          <h3 style="color: #991b1b; margin: 0 0 16px; font-size: 18px; display: flex; align-items: center;">
            <span style="font-size: 24px; margin-right: 8px;">👤</span>
            ${order.customerName}
          </h3>
          <div style="background: white; padding: 16px; border-radius: 6px; border-left: 4px solid #dc2626;">
            <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📋 Order Items:</p>
            <ul style="margin: 0; padding-left: 20px; list-style: none;">
              ${order.items
                .map(i => `<li style="color: #374151; margin-bottom: 6px; font-size: 15px;">
                  <span style="display: inline-block; width: 24px; text-align: center; font-weight: 600; color: #dc2626;">${i.quantity}×</span>
                  <span style="font-weight: 500;">${i.name}</span>
                </li>`)
                .join('')}
            </ul>
          </div>
        </div>

        <div style="background: #fee2e2; border: 2px solid #dc2626; padding: 16px; border-radius: 8px; text-align: center;">
          <p style="color: #7f1d1d; margin: 0; font-size: 14px; font-weight: 600;">
            ⚡ URGENT: No delivery time was specified. Prepare this order ASAP!
          </p>
        </div>
      `
      const htmlBody = emailWrapper(content, order.mealType || order.originalMealType)
      const plainTextBody = `Yellow Roast Co. - URGENT: New Order - No Time Specified

Customer: ${order.customerName}
Received: ${todayLabel()} at ${nowLabel()}

Order Items:
${order.items
  .map(i => `- ${i.quantity}x ${i.name}`)
  .join('\n')}

URGENT: No delivery time was specified. Prepare this order ASAP!`

      const sent = await sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail)
      if (sent && order.id) {
        addNotifiedOrders([order.id])
      }
      if (!sent) {
        console.warn('[email-notifications] Immediate order email failed to send')
      }
      return sent
    }

    // If cookTime is set, check if it's within 2 hours
    const [hours, minutes] = order.cookTime.split(':').map(Number)
    const deliveryTime = new Date(now)
    deliveryTime.setHours(hours, minutes, 0, 0)
    const hoursUntilDelivery = (deliveryTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    console.log('[email-notifications] Time until delivery:', hoursUntilDelivery, 'hours')

    // If delivery is more than 2 hours away, skip this notification (let advanced system handle it)
    if (hoursUntilDelivery > 2) {
      console.log('[email-notifications] ℹ️ Delivery is more than 2 hours away - will be handled by advanced notifications')
      return false
    }

    // SCENARIO 2: Delivery within 2 hours - notify immediately to start prep
    const subject = `🆕 New Order - Delivery in ${Math.round(hoursUntilDelivery * 60)} Minutes`
    const deliveryTimeLabel = formatCookTime(order.cookTime || "")
    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 48px; margin-bottom: 8px;">🐔</div>
        <h2 style="color: #dc2626; margin: 0; font-size: 24px;">New Order - Immediate Prep Required</h2>
        <p style="color: #6b7280; margin: 4px 0 0; font-size: 13px;">Delivery in ~${Math.round(hoursUntilDelivery * 60)} minutes at ${deliveryTimeLabel}</p>
      </div>

      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%); padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 5px solid #d97706;">
        <h3 style="color: #991b1b; margin: 0 0 16px; font-size: 18px; display: flex; align-items: center;">
          <span style="font-size: 24px; margin-right: 8px;">👤</span>
          ${order.customerName}
        </h3>
        <div style="background: white; padding: 16px; border-radius: 6px; border-left: 4px solid #dc2626; margin-bottom: 12px;">
          <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; font-weight: 600;">⏰ Scheduled Delivery Time:</p>
          <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">${deliveryTimeLabel}</p>
        </div>
        <div style="background: white; padding: 16px; border-radius: 6px; border-left: 4px solid #dc2626;">
          <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📋 Order Items:</p>
          <ul style="margin: 0; padding-left: 20px; list-style: none;">
            ${order.items
              .map(i => `<li style="color: #374151; margin-bottom: 6px; font-size: 15px;">
                <span style="display: inline-block; width: 24px; text-align: center; font-weight: 600; color: #dc2626;">${i.quantity}×</span>
                <span style="font-weight: 500;">${i.name}</span>
              </li>`) 
              .join('')}
          </ul>
        </div>
      </div>

      <div style="background: #fee2e2; border: 2px solid #dc2626; padding: 16px; border-radius: 8px; text-align: center;">
        <p style="color: #7f1d1d; margin: 0; font-size: 14px; font-weight: 600;">
          ⚡ START PREPARATION NOW - Delivery in ~${Math.round(hoursUntilDelivery * 60)} minutes!
        </p>
      </div>
    `
    const htmlBody = emailWrapper(content, order.mealType || order.originalMealType)
    const plainTextBody = `Yellow Roast Co. - New Order - Immediate Prep Required

Customer: ${order.customerName}
Delivery Time: ${deliveryTimeLabel}
Time Remaining: ~${Math.round(hoursUntilDelivery * 60)} minutes

Order Items:
${order.items
  .map(i => `- ${i.quantity}x ${i.name}`)
  .join('\n')}

START PREPARATION NOW - Delivery in ~${Math.round(hoursUntilDelivery * 60)} minutes!`

    const sent = await sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail)
    if (sent && order.id) {
      addNotifiedOrders([order.id])
    }
    return sent
  } catch (err) {
    console.error('[email-notifications] Error sending new-order notification:', err)
    return false
  }
}

/**
 * Send daily reminder about upcoming orders for tomorrow
 */
export const sendUpcomingOrdersReminder = async (
  tomorrowOrders: Array<{
    customerName: string;
    items: Array<{ name: string; quantity: number }>;
    date: string;
  }>,
  recipientEmail?: string
): Promise<void> => {
  if (!recipientEmail || tomorrowOrders.length === 0) return

  try {
    // Calculate tomorrow in Philippines timezone
    const phTime = getPHTime()
    const tomorrow = new Date(phTime)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const tomorrowLabel = tomorrow.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila'
    })

    const subject = `📅 Upcoming Orders for ${tomorrowLabel}`

    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 48px; margin-bottom: 8px;">📅</div>
        <h2 style="color: #dc2626; margin: 0; font-size: 24px;">Upcoming Orders Reminder</h2>
        <p style="color: #6b7280; margin: 4px 0 0; font-size: 14px;">${tomorrowLabel}</p>
      </div>

      <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <h3 style="color: #991b1b; margin: 0 0 16px; font-size: 18px;">📋 Orders for Tomorrow (${tomorrowOrders.length} customer${tomorrowOrders.length > 1 ? 's' : ''})</h3>

        ${tomorrowOrders.map((order, index) => `
          <div style="background: white; padding: 16px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #d97706;">
            <h4 style="color: #374151; margin: 0 0 8px; font-size: 16px;">${index + 1}. 👤 ${order.customerName}</h4>
            <ul style="margin: 0; padding-left: 20px;">
              ${order.items
                .map(i => `<li style="color: #374151; margin-bottom: 2px;">${i.quantity}× ${i.name}</li>`)
                .join('')}
            </ul>
          </div>
        `).join('')}
      </div>

      <div style="background: #ecfdf5; border: 1px solid #d1fae5; padding: 16px; border-radius: 8px;">
        <p style="color: #065f46; margin: 0; font-size: 14px;">
          <strong>⏰ Preparation Reminder:</strong> These orders are scheduled for tomorrow. Please ensure all ingredients and preparations are ready.
        </p>
      </div>
    `

    const htmlBody = emailWrapper(content, firstOrder.mealType || firstOrder.originalMealType)
    const plainTextBody = `Yellow Roast Co. - Upcoming Orders for ${tomorrowLabel}

You have ${tomorrowOrders.length} order${tomorrowOrders.length > 1 ? 's' : ''} scheduled for tomorrow:

${tomorrowOrders.map((order, index) => `
${index + 1}. ${order.customerName}
${order.items.map(i => `   - ${i.quantity}x ${i.name}`).join('\n')}
`).join('\n')}

Please ensure all ingredients and preparations are ready for tomorrow's orders.`

    await sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail)
    console.log(`[email-notifications] Sent upcoming orders reminder for ${tomorrowLabel} to ${recipientEmail}`)
  } catch (err) {
    console.error('[email-notifications] Error sending upcoming orders reminder:', err)
  }
}

/**
 * Check for orders scheduled for tomorrow and send reminder if any exist
 */
export const checkAndSendUpcomingOrdersReminder = async (
  getOrdersForDate: (date: string) => Array<{
    customerName: string;
    items: Array<{ name: string; quantity: number }>;
    date: string;
  }>,
  recipientEmail?: string
): Promise<void> => {
  if (!recipientEmail) return

  try {
    // Get tomorrow's date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0] // YYYY-MM-DD format

    // Get all orders for tomorrow
    const tomorrowOrders = getOrdersForDate(tomorrowStr)

    if (tomorrowOrders.length > 0) {
      await sendUpcomingOrdersReminder(tomorrowOrders, recipientEmail)
    }
  } catch (error) {
    console.error('[email-notifications] Error checking upcoming orders:', error)
  }
}

/**
 * Advanced notification system for future orders with time-based alerts
 * Sends:
 * 1. "1 day before" email when delivery date is tomorrow
 * 2. "1 hour before" email when delivery time is approaching
 */
interface AdvancedNotificationState {
  sentOneDayReminders: Set<string> // bucket keys: within_1hr | 1_to_2hrs | above_2hrs | 3_days_advance
  sentOneHourReminders: Set<string> // bucket keys: within_1hr | 1_to_2hrs | above_2hrs | 3_days_advance
  sentThirtyMinuteReminders: Set<string> // bucket keys: within_1hr | 1_to_2hrs | above_2hrs | 3_days_advance
}

let advancedNotificationState: AdvancedNotificationState = {
  sentOneDayReminders: new Set(),
  sentOneHourReminders: new Set(),
  sentThirtyMinuteReminders: new Set(),
}

type TimeBucket = 'within_1hr' | '1_to_2hrs' | 'above_2hrs' | '3_days_advance'

/**
 * Group orders by time-to-delivery buckets (ALL orders in same bucket grouped together)
 * This ensures all 1-hour due orders are in ONE email, not split by exact time
 */
const groupOrdersByTimeBucket = (orders: CustomerOrder[]): Map<TimeBucket, CustomerOrder[]> => {
  const now = getPHTime()
  const groups: Map<TimeBucket, CustomerOrder[]> = new Map([
    ['within_1hr', []],
    ['1_to_2hrs', []],
    ['above_2hrs', []],
    ['3_days_advance', []]
  ])

  orders.forEach(order => {
    if (!order.cookTime) {
      groups.get('within_1hr')!.push(order)
      return
    }

    const deliveryDate = parseLocalDate(order.createdAt)
    const [hours, minutes] = order.cookTime.split(':').map(Number)
    deliveryDate.setHours(hours, minutes, 0, 0)

    const timeUntilDelivery = deliveryDate.getTime() - now.getTime()
    const hoursUntilDelivery = timeUntilDelivery / (1000 * 60 * 60)
    const daysUntilDelivery = timeUntilDelivery / (1000 * 60 * 60 * 24)

    if (hoursUntilDelivery <= 1 && hoursUntilDelivery > 0) {
      groups.get('within_1hr')!.push(order)
    } else if (hoursUntilDelivery <= 2 && hoursUntilDelivery > 1) {
      groups.get('1_to_2hrs')!.push(order)
    } else if (daysUntilDelivery >= 2 && daysUntilDelivery <= 3) {
      groups.get('3_days_advance')!.push(order)
    } else if (hoursUntilDelivery > 2) {
      groups.get('above_2hrs')!.push(order)
    }
  })

  return groups
}

const getTimeBucketKey = (bucket: TimeBucket): string => {
  return bucket // Simple string key for each bucket
}

/**
 * SCENARIO 3: Advanced notification system for future orders with time-based alerts
 * A day before delivery: sends "prepare tomorrow" reminder
 * Then 1 hour before: sends "final preparation" urgent alert
 * 
 * Groups ALL orders by time buckets (within_1hr, 1_to_2hrs, etc.)
 * and sends ONE email per bucket
 * 
 * Call this periodically (e.g., every 30 minutes or hourly)
 */
export const checkAndSendAdvancedOrderNotifications = async (
  orders: CustomerOrder[],
  recipientEmail?: string
): Promise<void> => {
  console.log('[email-notifications] checkAndSendAdvancedOrderNotifications called with', orders.length, 'orders', 'recipient:', recipientEmail ? '✓' : '✗')
  
  if (!recipientEmail || !orders.length) {
    console.log('[email-notifications] ⏭️ Skipping advanced notifications - recipientEmail:', !!recipientEmail, 'orders:', orders.length)
    return
  }

  try {
    // Filter to only valid orders (have delivery time, not yet delivered/served)
    const validOrders = orders.filter(o =>
      o.cookTime &&
      o.status !== 'served' &&
      o.status !== 'delivered' &&
      o.status !== 'complete'
    )

    const now = getPHTime()

    // GROUP BY TIME BUCKETS - all orders in same bucket get ONE email together
    const timeGrouped = groupOrdersByTimeBucket(validOrders)

    // Process each time bucket
    for (const [bucket, bucketOrders] of timeGrouped.entries()) {
      if (bucketOrders.length === 0) continue

      const bucketKey = getTimeBucketKey(bucket)
      console.log(`[email-notifications] Processing bucket "${bucket}" with ${bucketOrders.length} order(s)`)

      // Get earliest delivery time in this bucket for timing decisions
      let earliestDeliveryTime = 0
      bucketOrders.forEach(order => {
        if (order.cookTime) {
          const deliveryDate = parseLocalDate(order.createdAt)
          const [hours, minutes] = order.cookTime.split(':').map(Number)
          deliveryDate.setHours(hours, minutes, 0, 0)
          const deliveryTime = deliveryDate.getTime()
          if (earliestDeliveryTime === 0 || deliveryTime < earliestDeliveryTime) {
            earliestDeliveryTime = deliveryTime
          }
        }
      })

      const timeUntilEarliestDelivery = earliestDeliveryTime - now.getTime()
      const hoursUntilDelivery = timeUntilEarliestDelivery / (1000 * 60 * 60)
      const daysUntilDelivery = timeUntilEarliestDelivery / (1000 * 60 * 60 * 24)

      console.log(`[email-notifications] Bucket "${bucket}":`, {
        ordersCount: bucketOrders.length,
        hoursUntilDelivery: hoursUntilDelivery.toFixed(2),
        daysUntilDelivery: daysUntilDelivery.toFixed(2),
        alreadySent1DayReminder: advancedNotificationState.sentOneDayReminders.has(bucketKey),
        alreadySent1HourReminder: advancedNotificationState.sentOneHourReminders.has(bucketKey),
        alreadySent30MinReminder: advancedNotificationState.sentThirtyMinuteReminders.has(bucketKey)
      })

      // SCENARIO 3A: 2-HOUR BEFORE REMINDER for TOMORROW'S orders
      // When an order is placed for tomorrow, notify 2 hours before the delivery time
      // This means: delivery is within 25hrs but more than 1hr away, and between 0-2hrs window
      if (daysUntilDelivery <= 1 && hoursUntilDelivery <= 2 && hoursUntilDelivery > 1 && !advancedNotificationState.sentOneDayReminders.has(bucketKey)) {
        console.log(`[email-notifications] 📅 Sending 2-hour pre-reminder for bucket "${bucket}" (${bucketOrders.length} orders)`)
        await sendOneDayBeforeNotification(bucketOrders, recipientEmail)
        advancedNotificationState.sentOneDayReminders.add(bucketKey)
      }

      // SCENARIO 3B: 1-HOUR BEFORE REMINDER - For same-day/today orders, 1 hour before delivery
      // This fires when delivery time is within 1 hour
      if (hoursUntilDelivery <= 1 && hoursUntilDelivery > 0 && !advancedNotificationState.sentOneHourReminders.has(bucketKey)) {
        console.log(`[email-notifications] 🚨 Sending 1-hour reminder for bucket "${bucket}" (${bucketOrders.length} orders)`)
        await sendOneHourBeforeNotification(bucketOrders, recipientEmail)
        advancedNotificationState.sentOneHourReminders.add(bucketKey)
      }

      // 30-MINUTE BEFORE REMINDER (<=0.5h and >0)
      if (hoursUntilDelivery <= 0.5 && hoursUntilDelivery > 0 && !advancedNotificationState.sentThirtyMinuteReminders.has(bucketKey)) {
        console.log(`[email-notifications] ⏰ Sending 30-minute reminder for bucket "${bucket}" (${bucketOrders.length} orders)`)
        await sendThirtyMinuteNotification(bucketOrders, recipientEmail)
        advancedNotificationState.sentThirtyMinuteReminders.add(bucketKey)
      }
    }
  } catch (error) {
    console.error('[email-notifications] Error checking advanced notifications:', error)
  }
}

/**
 * Send "1 day before delivery" notification (grouped by delivery time)
 * SCENARIO 3A: For orders scheduled 1-2 days away
 */
const sendOneDayBeforeNotification = async (
  orders: CustomerOrder[],
  recipientEmail: string
): Promise<void> => {
  if (orders.length === 0) return

  try {
    const firstOrder = orders[0]
    const deliveryDate = parseLocalDate(firstOrder.createdAt)
    if (firstOrder.cookTime) {
      const [hours, minutes] = firstOrder.cookTime.split(':').map(Number)
      deliveryDate.setHours(hours, minutes, 0, 0)
    }

    const deliveryDateLabel = deliveryDate.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila'
    })

    const deliveryTimeLabel = formatCookTime(firstOrder.cookTime)

    const subject = `📅 Reminder: ${orders.length} Order${orders.length > 1 ? 's' : ''} — Delivery in ~2 Hours — ${deliveryTimeLabel}`

    const oneDayMealType = (firstOrder.mealType || firstOrder.originalMealType || 'dinner').toLowerCase()
    const oneDayColors = headerColorsForMeal(oneDayMealType)
    const ordersTableOneDayHtml = renderOrderTable(orders, oneDayColors)

    const content = `
      <div style="margin-bottom:24px;">
        <div style="display:inline-block;background:${oneDayColors.badgeBg};border:1px solid ${oneDayColors.badgeBorder};border-radius:20px;padding:6px 16px;margin-bottom:16px;">
          <span style="color:${oneDayColors.badgeText};font-weight:700;font-size:12px;letter-spacing:0.5px;">📅 2-HOUR ADVANCE REMINDER</span>
        </div>
        <h2 style="margin:0 0 8px;color:#111827;font-size:24px;font-weight:800;">
          ${orders.length} Order${orders.length > 1 ? 's' : ''} Due Tomorrow
        </h2>
        <p style="margin:0;color:#6b7280;font-size:14px;">
          Scheduled for <strong>${deliveryDateLabel}</strong> at <strong style="color:${oneDayColors.tableAccent};">${deliveryTimeLabel}</strong>
        </p>
      </div>

      ${ordersTableOneDayHtml}

      <div style="margin-top:20px;padding:16px 18px;background:#eff6ff;border:2px solid #3b82f6;border-radius:8px;text-align:center;">
        <p style="color:#1e40af;margin:0;font-size:14px;font-weight:700;">
          ✅ ACTION: Delivery is in ~2 hours at ${deliveryTimeLabel} — begin final preparation NOW!
        </p>
      </div>
    `

    const htmlBody = emailWrapper(content, oneDayMealType)
    const plainTextBody = `Yellow Roast Co. - Orders Due Tomorrow at ${deliveryTimeLabel}

Delivery: ${deliveryDateLabel} at ${deliveryTimeLabel}

${orders
      .map(o =>
        `${o.customerName} | ${o.orderedItems
          .map((i: any) => `${i.quantity}x ${i.name}`)
          .join(', ')}`
      )
      .join('\n')}

ACTION: Delivery is in approximately 2 hours at ${deliveryTimeLabel}. Begin preparation immediately!`

    await sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail)
    console.log(`[email-notifications] Sent 1-day reminder for group with ${orders.length} order(s)`)
  } catch (err) {
    console.error('[email-notifications] Error sending 1-day notification:', err)
  }
}



/**
 * Send "1 hour before delivery" notification (grouped by delivery time)
 * SCENARIO 3B: Final urgent reminder before delivery
 */
const sendOneHourBeforeNotification = async (
  orders: CustomerOrder[],
  recipientEmail: string
): Promise<void> => {
  if (orders.length === 0) return

  try {
    const firstOrder = orders[0]
    const deliveryDate = parseLocalDate(firstOrder.createdAt)
    if (firstOrder.cookTime) {
      const [hours, minutes] = firstOrder.cookTime.split(':').map(Number)
      deliveryDate.setHours(hours, minutes, 0, 0)
    }

    const deliveryDateLabel = deliveryDate.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila'
    })

    const deliveryTimeLabel = formatCookTime(firstOrder.cookTime)

    const subject = `🚨 URGENT: ${orders.length} Order${orders.length > 1 ? 's' : ''} Due in 1 Hour — ${deliveryTimeLabel}`

    const oneHrMealType = (firstOrder.mealType || firstOrder.originalMealType || 'dinner').toLowerCase()
    const oneHrColors = headerColorsForMeal(oneHrMealType)
    const ordersTableOneHrHtml = renderOrderTable(orders, oneHrColors)

    const content = `
      <div style="margin-bottom:24px;">
        <div style="display:inline-block;background:#fee2e2;border:2px solid #dc2626;border-radius:20px;padding:6px 16px;margin-bottom:16px;">
          <span style="color:#991b1b;font-weight:800;font-size:12px;letter-spacing:0.5px;">🚨 1-HOUR URGENT REMINDER</span>
        </div>
        <h2 style="margin:0 0 8px;color:#991b1b;font-size:26px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;">
          ${orders.length} Order${orders.length > 1 ? 's' : ''} in 1 Hour!
        </h2>
        <p style="margin:0;color:#6b7280;font-size:14px;">
          Delivery at <strong style="color:#dc2626;font-size:18px;">${deliveryTimeLabel}</strong> — <strong>final preparation required NOW</strong>
        </p>
      </div>

      ${ordersTableOneHrHtml}

      <div style="margin-top:20px;padding:18px;background:#fee2e2;border:3px solid #dc2626;border-radius:8px;text-align:center;">
        <p style="color:#7f1d1d;margin:0;font-size:16px;font-weight:800;">
          ⚡ PACK ALL ORDERS NOW FOR IMMEDIATE DELIVERY!
        </p>
        <p style="color:#991b1b;margin:8px 0 0;font-size:13px;">
          Delivery scheduled for ${deliveryDateLabel} at ${deliveryTimeLabel}
        </p>
      </div>
    `

    const htmlBody = emailWrapper(content, oneHrMealType)
    const plainTextBody = `Yellow Roast Co. - URGENT: ${orders.length} Order${orders.length > 1 ? 's' : ''} - 1 HOUR

⚡ URGENT: ${orders.length} order(s) delivery in 1 HOUR

Delivery Time: ${deliveryTimeLabel}
Date: ${deliveryDateLabel}

${orders
      .map(o =>
        `${o.customerName} | ${o.orderedItems
          .map((i: any) => `${i.quantity}x ${i.name}`)
          .join(', ')}`
      )
      .join('\n')}

FINAL PREPARATION: Pack all orders NOW for immediate delivery!`

    await sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail)
    console.log(`[email-notifications] Sent 1-hour reminder for group with ${orders.length} order(s)`)
  } catch (err) {
    console.error('[email-notifications] Error sending 1-hour notification:', err)
  }
}



/**
 * Send 30-minute-before delivery notification (grouped by delivery time)
 */
const sendThirtyMinuteNotification = async (
  orders: CustomerOrder[],
  recipientEmail: string
): Promise<void> => {
  if (orders.length === 0) return

  try {
    const firstOrder = orders[0]
    const deliveryDate = parseLocalDate(firstOrder.createdAt)
    if (firstOrder.cookTime) {
      const [hours, minutes] = firstOrder.cookTime.split(':').map(Number)
      deliveryDate.setHours(hours, minutes, 0, 0)
    }

    const deliveryDateLabel = deliveryDate.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila'
    })

    const deliveryTimeLabel = formatCookTime(firstOrder.cookTime)

    const subject = `⏰ 30 Min Warning: ${orders.length} Order${orders.length > 1 ? 's' : ''} Due at ${deliveryTimeLabel}`

    const thirtyMinMealType = (firstOrder.mealType || firstOrder.originalMealType || 'dinner').toLowerCase()
    const thirtyMinColors = headerColorsForMeal(thirtyMinMealType)
    const ordersTable30MinHtml = renderOrderTable(orders, thirtyMinColors)

    const content = `
      <div style="margin-bottom:24px;">
        <div style="display:inline-block;background:#fff7ed;border:2px solid #f97316;border-radius:20px;padding:6px 16px;margin-bottom:16px;">
          <span style="color:#c2410c;font-weight:800;font-size:12px;letter-spacing:0.5px;">⏰ 30-MINUTE WARNING</span>
        </div>
        <h2 style="margin:0 0 8px;color:#c2410c;font-size:26px;font-weight:900;">
          🚗 Delivery in 30 Minutes!
        </h2>
        <p style="margin:0;color:#6b7280;font-size:14px;">
          Orders due at <strong style="color:#f97316;font-size:18px;">${deliveryTimeLabel}</strong> — ensure everything is packed and ready.
        </p>
      </div>

      ${ordersTable30MinHtml}

      <div style="margin-top:20px;padding:18px;background:#fff7ed;border:3px solid #f97316;border-radius:8px;text-align:center;">
        <p style="color:#c2410c;margin:0;font-size:15px;font-weight:800;">
          ✅ Finalize packing — customer pickup/delivery in 30 minutes!
        </p>
        <p style="color:#ea580c;margin:8px 0 0;font-size:13px;">
          ${deliveryDateLabel} at ${deliveryTimeLabel}
        </p>
      </div>
    `

    const htmlBody = emailWrapper(content, thirtyMinMealType)
    const plainTextBody = `Yellow Roast Co. - Ready for Delivery in 30 Minutes

READY: ${orders.length} order(s) are packed and ready!

Delivery at: ${deliveryTimeLabel}
Date: ${deliveryDateLabel}

${orders
      .map(o =>
        `${o.customerName} | ${o.orderedItems
          .map((i: any) => `${i.quantity}x ${i.name}`)
          .join(', ')}`
      )
      .join('\n')}

All orders packed and ready. Customer arriving soon!`

    await sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail)
    console.log(`[email-notifications] Sent 30-minute reminder for group with ${orders.length} order(s)`)
  } catch (err) {
    console.error('[email-notifications] Error sending 30-minute notification:', err)
  }
}


export const resetAdvancedNotificationState = (): void => {
  advancedNotificationState = {
    sentOneDayReminders: new Set(),
    sentOneHourReminders: new Set(),
    sentThirtyMinuteReminders: new Set(),
  }
  console.log('[email-notifications] Advanced notification state reset for new day')
}