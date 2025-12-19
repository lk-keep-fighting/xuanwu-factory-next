# 方法1：刷新 DNS 缓存
sudo dscacheutil -flushcache

# 方法2：重启 mDNSResponder（你用的这个）
sudo killall -HUP mDNSResponder

# 方法3：组合使用（最彻底）
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
