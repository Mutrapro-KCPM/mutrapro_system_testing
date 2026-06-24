import jenkins.model.*
import hudson.security.*

def instance = Jenkins.getInstance()

// Tắt hoàn toàn chế độ đăng nhập (Không cần login)
instance.setSecurityRealm(SecurityRealm.NO_AUTHENTICATION)
instance.setAuthorizationStrategy(AuthorizationStrategy.UNSECURED)

instance.save()
