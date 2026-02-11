package security

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"log"
)

const rsaPublicKeyPEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApnYk3y2wsiyXZ7XKQK8Y
6lwdEsklr/WSNJXoCPS+LI3f0I8kypw7jneUFDsTjKDJkg0sUQKPqFG9JGNB3DEC
/iK4BbFN+dYefYKdR5qibKc1+S76dLV9rPasNpVaJYxIKaji1l2r6nEJco77ShP9
AhFu0ON3KyNqw/o31VjkX17c1UqtYMWGh/tJEIVZjaIlOb5vxyW6q4iNl4qJ4xK/
CNIBFTmD3/QmDlonxUirSHjDi/5TIVrJK0Y/dR/jGSFxjNX/ouEIY9xO+lfHUobW
wTYIYL5FgTDUBdvh06xYvzMwKvxX0vXeZMjIujS3qXPWnBbsyf+3SNeoAVNfNHot
PwIDAQAB
-----END PUBLIC KEY-----`

var rsaPublicKey *rsa.PublicKey

func init() {
	block, _ := pem.Decode([]byte(rsaPublicKeyPEM))
	if block == nil {
		log.Fatal("failed to decode RSA public key PEM")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		log.Fatal("failed to parse RSA public key: ", err)
	}

	key, ok := pub.(*rsa.PublicKey)
	if !ok {
		log.Fatal("key is not RSA public key")
	}

	rsaPublicKey = key
}

func GetRSAPublicKey() *rsa.PublicKey {
	return rsaPublicKey
}
